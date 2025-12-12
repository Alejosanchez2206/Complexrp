// events/voiceWaitingRoom.js
const { Events, EmbedBuilder, ChannelType } = require('discord.js');
const config = require('../../config.json');

// Mapas de control
const voiceStartTime = new Map();
const notifiedUsers = new Set();
const lastBotMessages = new Map();

// Configuración
const CHECK_INTERVAL = 10 * 1000; // 10 segundos
const WAIT_THRESHOLD = 3 * 60 * 1000; // 3 minutos
const MAX_MESSAGES_TO_DELETE = 10;

/**
 * Formatea duración en milisegundos a formato legible
 */
function formatDuration(ms) {
    const hours = Math.floor(ms / 3600000);
    const minutes = Math.floor((ms % 3600000) / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    
    if (hours > 0) {
        return `${hours}h ${minutes}m ${seconds}s`;
    }
    return `${minutes}m ${seconds}s`;
}

module.exports = {
    name: Events.VoiceStateUpdate,
    once: false,

    /**
     * @param {import('discord.js').VoiceState} oldState
     * @param {import('discord.js').VoiceState} newState
     * @param {import('discord.js').Client} client
     */
    async execute(oldState, newState, client) {
        const user = newState.member?.user;
        if (!user || user.bot) return;

        const userId = user.id;
        const guildId = newState.guild.id;
        const key = `${guildId}-${userId}`;
        const username = user.tag;

        // Usuario entra a la sala de espera
        if (!oldState.channel && newState.channel?.id === config.waitingRoomChannelId) {
            voiceStartTime.set(key, Date.now());
            console.log(`✅ [JOIN] ${username} entró a la sala de espera a las ${new Date().toLocaleTimeString()}`);
        }

        // Usuario sale completamente del canal de voz
        else if (oldState.channel?.id === config.waitingRoomChannelId && !newState.channel) {
            const startTime = voiceStartTime.get(key);
            if (startTime) {
                const duration = Date.now() - startTime;
                console.log(`📤 [LEAVE] ${username} salió del canal de voz. Duración: ${formatDuration(duration)}`);
            }
            voiceStartTime.delete(key);
            notifiedUsers.delete(key);
        }

        // Usuario cambia de canal
        else if (oldState.channel?.id !== newState.channel?.id) {
            if (oldState.channel?.id === config.waitingRoomChannelId) {
                const startTime = voiceStartTime.get(key);
                if (startTime) {
                    const duration = Date.now() - startTime;
                    console.log(`🔄 [OUT] ${username} salió de la sala de espera. Duración: ${formatDuration(duration)}`);
                }
                voiceStartTime.delete(key);
                notifiedUsers.delete(key);
            }
            if (newState.channel?.id === config.waitingRoomChannelId) {
                voiceStartTime.set(key, Date.now());
                console.log(`🔄 [IN] ${username} entró a la sala de espera a las ${new Date().toLocaleTimeString()}`);
            }
        }

        // Iniciar monitor una sola vez
        if (!client._monitorInitialized) {
            console.log('⏱️ Iniciando monitoreo de sala de espera...');
            console.log(`📊 Configuración: Intervalo=${CHECK_INTERVAL/1000}s, Umbral=${WAIT_THRESHOLD/1000}s`);
            setInterval(() => checkWaitingUsers(client), CHECK_INTERVAL);
            client._monitorInitialized = true;
        }
    }
};

/**
 * Verifica usuarios esperando y envía notificaciones
 */
async function checkWaitingUsers(client) {
    const now = Date.now();
    const guildMap = new Map();

    // Agrupar usuarios por guild
    for (const [key, startTime] of voiceStartTime.entries()) {
        const [guildId, userId] = key.split('-');

        const guild = client.guilds.cache.get(guildId);
        if (!guild) {
            voiceStartTime.delete(key);
            notifiedUsers.delete(key);
            continue;
        }

        const member = guild.members.cache.get(userId);
        if (!member?.voice?.channel || member.voice.channel.id !== config.waitingRoomChannelId) {
            voiceStartTime.delete(key);
            notifiedUsers.delete(key);
            continue;
        }

        const timeElapsed = now - startTime;

        if (timeElapsed >= WAIT_THRESHOLD) {
            if (!guildMap.has(guildId)) {
                guildMap.set(guildId, []);
            }
            guildMap.get(guildId).push({ member, timeElapsed, key, startTime });
        }
    }

    // Si no hay usuarios esperando, retornar
    if (guildMap.size === 0) return;

    // Enviar notificaciones por guild
    for (const [guildId, users] of guildMap.entries()) {
        const guild = client.guilds.cache.get(guildId);
        const channel = guild.channels.cache.get(config.staffAlertChannel);

        if (!channel || channel.type !== ChannelType.GuildText) {
            console.warn(`⚠️ Canal de alertas no encontrado o no es de texto en ${guild.name}`);
            continue;
        }

        // Verificar permisos del bot
        const botPermissions = channel.permissionsFor(guild.members.me);
        if (!botPermissions.has(['SendMessages', 'ViewChannel', 'ManageMessages'])) {
            console.error(`❌ Permisos insuficientes en ${channel.name} (${guild.name})`);
            continue;
        }

        // Eliminar mensajes anteriores del bot
        try {
            const messages = await channel.messages.fetch({ limit: MAX_MESSAGES_TO_DELETE });
            const botMessages = messages.filter(msg => 
                msg.author.id === client.user.id && 
                msg.embeds.length > 0 &&
                msg.embeds[0].title === '📌 Usuarios esperando atención'
            );

            if (botMessages.size > 0) {
                await channel.bulkDelete(botMessages, true);
                console.log(`🗑️ ${botMessages.size} mensaje(s) anterior(es) eliminado(s) en ${guild.name}`);
            }
        } catch (error) {
            if (error.code !== 10008) { // Ignorar error de mensaje ya eliminado
                console.error(`❌ Error borrando mensajes del bot: ${error.message}`);
            }
        }

        // Identificar usuarios nuevos
        const usersToNotify = users.filter(u => !notifiedUsers.has(u.key));
        const hasNewUsers = usersToNotify.length > 0;

        // Crear lista de usuarios
        const list = users
            .sort((a, b) => b.timeElapsed - a.timeElapsed)
            .map(({ member, timeElapsed, key }) => {
                const isNew = usersToNotify.some(u => u.key === key);
                const globalName = member.user.globalName || member.user.username;
                const indicator = isNew ? '🆕' : '⏳';
                return `${indicator} <@${member.user.id}> (${globalName}) — **${formatDuration(timeElapsed)}**`;
            }).join('\n');

        // Crear embed
        const embed = new EmbedBuilder()
            .setTitle('📌 Usuarios esperando atención')
            .setColor(hasNewUsers ? '#FF0000' : '#FFA500')
            .setDescription('Los siguientes miembros llevan un tiempo considerable en la sala de espera.')
            .addFields({
                name: `👥 Total: ${users.length} ${hasNewUsers ? `(${usersToNotify.length} nuevo${usersToNotify.length !== 1 ? 's' : ''})` : ''}`,
                value: list || 'No hay usuarios en espera.',
                inline: false
            })
            .addFields({
                name: '📊 Estadísticas',
                value: `**Tiempo promedio:** ${formatDuration(users.reduce((sum, u) => sum + u.timeElapsed, 0) / users.length)}\n` +
                       `**Tiempo máximo:** ${formatDuration(Math.max(...users.map(u => u.timeElapsed)))}`,
                inline: false
            })
            .setFooter({
                text: `${guild.name} • Actualizado cada ${CHECK_INTERVAL/1000}s`,
                iconURL: guild.iconURL({ dynamic: true })
            })
            .setTimestamp();

        // Enviar mensaje
        try {
            const roleMention = config.pingRolStaff ? `<@&${config.pingRolStaff}>` : '';
            
            const sentMessage = await channel.send({
                content: hasNewUsers 
                    ? `🔔 **Atención ${roleMention}**: Hay ${usersToNotify.length} nuevo${usersToNotify.length !== 1 ? 's' : ''} usuario${usersToNotify.length !== 1 ? 's' : ''} esperando.` 
                    : `📊 Actualización de usuarios en espera:`,
                embeds: [embed]
            });

            lastBotMessages.set(channel.id, sentMessage.id);

            // Marcar usuarios como notificados
            usersToNotify.forEach(u => notifiedUsers.add(u.key));

            console.log(`📢 [${new Date().toLocaleTimeString()}] Notificación enviada en ${guild.name}: ${users.length} usuario(s), ${usersToNotify.length} nuevo(s)`);

        } catch (error) {
            console.error(`❌ Error enviando notificación en ${guild.name}:`, error.message);
            
            if (error.code === 50013 || error.code === 50001) {
                lastBotMessages.delete(channel.id);
            }
        }
    }
}
