const { Events, EmbedBuilder, ChannelType } = require('discord.js');
const config = require('../../config.json');
const tabsStaffSchema = require('../../Models/tabsStaffSchema');

const voiceStartTime = new Map();
const notifiedUsers = new Set();
const lastBotMessages = new Map(); // Almacena los últimos mensajes del bot por canal

// Variables de configuración
const CHECK_INTERVAL = 10 * 1000; // 10 segundos
const WAIT_THRESHOLD = 3 * 60 * 1000; // 3 minutos
const MAX_MESSAGES_TO_DELETE = 5; // Máximo de mensajes anteriores a eliminar

/**
 * Formatea una duración en milisegundos a formato legible
 * @param {number} ms - Milisegundos
 * @returns {string} Tiempo formateado
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

/**
 * Elimina los mensajes anteriores del bot en el canal especificado
 * @param {import('discord.js').TextChannel} channel - Canal donde eliminar mensajes
 * @param {string} botId - ID del bot
 */
async function deletePreviousBotMessages(channel, botId) {
    try {
        // Intentar obtener los últimos mensajes del canal
        const messages = await channel.messages.fetch({ limit: MAX_MESSAGES_TO_DELETE });
        
        // Filtrar solo los mensajes del bot sobre la sala de espera
        const botMessages = messages.filter(msg => 
            msg.author.id === botId && 
            msg.embeds.length > 0 &&
            msg.embeds[0].title === '📌 Usuarios en Sala de Espera'
        );

        // Eliminar los mensajes encontrados
        for (const message of botMessages.values()) {
            try {
                await message.delete();
                console.log(`🗑️ Mensaje anterior eliminado: ${message.id}`);
            } catch (deleteError) {
                if (deleteError.code !== 10008) { // Ignorar error de mensaje ya eliminado
                    console.error(`❌ Error eliminando mensaje ${message.id}:`, deleteError.message);
                }
            }
        }

        return botMessages.size;
    } catch (error) {
        console.error('❌ Error al buscar mensajes anteriores:', error.message);
        return 0;
    }
}

/**
 * Limpia los mensajes almacenados en caché que ya fueron eliminados
 * @param {string} channelId - ID del canal
 */
function cleanupDeletedMessages(channelId) {
    if (lastBotMessages.has(channelId)) {
        lastBotMessages.delete(channelId);
    }
}

module.exports = {
    name: Events.VoiceStateUpdate,
    once: false,

    /**
     * Maneja actualizaciones en el estado de voz de los miembros.
     * @param {import('discord.js').VoiceState} oldState
     * @param {import('discord.js').VoiceState} newState
     * @param {import('discord.js').Client} client
     */
    async execute(oldState, newState, client) {
        const userId = newState.member.user.id;
        const guildId = newState.guild.id;
        const key = `${guildId}-${userId}`;
        const username = newState.member.user.tag;

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

        // Inicializar el monitor solo una vez
        if (!client._monitorInitialized) {
            console.log('⏱️ Iniciando monitoreo de usuarios en sala de espera...');
            console.log(`📊 Configuración: Intervalo=${CHECK_INTERVAL/1000}s, Umbral=${WAIT_THRESHOLD/1000}s`);
            setInterval(() => checkWaitingUsers(client), CHECK_INTERVAL);
            client._monitorInitialized = true;
        }
    }
};

/**
 * Verifica periódicamente qué usuarios han pasado el umbral de espera
 * y envía una notificación al canal del staff.
 * @param {import('discord.js').Client} client - Cliente de Discord
 */
async function checkWaitingUsers(client) {
    const now = Date.now();
    const guildMap = new Map();

    // Verificar y agrupar usuarios por guild
    for (const [key, startTime] of voiceStartTime.entries()) {
        const [guildId, userId] = key.split('-');
        const guild = client.guilds.cache.get(guildId);
        
        if (!guild) {
            voiceStartTime.delete(key);
            notifiedUsers.delete(key);
            continue;
        }

        const member = guild.members.cache.get(userId);
        
        // Verificar que el miembro aún está en la sala de espera
        if (!member?.voice.channel || member.voice.channel.id !== config.waitingRoomChannelId) {
            voiceStartTime.delete(key);
            notifiedUsers.delete(key);
            continue;
        }

        const timeElapsed = now - startTime;
        
        // Solo notificar si superó el umbral
        if (timeElapsed >= WAIT_THRESHOLD) {
            if (!guildMap.has(guildId)) {
                guildMap.set(guildId, []);
            }
            guildMap.get(guildId).push({ member, timeElapsed, key, startTime });
        }
    }

    // Si no hay usuarios esperando, limpiar notificaciones anteriores
    if (guildMap.size === 0) {
        return;
    }

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

        // Identificar usuarios nuevos (que aún no han sido notificados)
        const usersToNotify = users.filter(u => !notifiedUsers.has(u.key));
        const hasNewUsers = usersToNotify.length > 0;

        // Preparar menciones de roles
        let roleMentions = '';
        if (config.pingRolStaff) {
            if (Array.isArray(config.pingRolStaff)) {
                roleMentions = config.pingRolStaff.map(roleId => `<@&${roleId}>`).join(' ');
            } else {
                roleMentions = `<@&${config.pingRolStaff}>`;
            }
        }

        // Crear lista de usuarios con indicadores
        const list = users
            .sort((a, b) => b.timeElapsed - a.timeElapsed) // Ordenar por tiempo de espera descendente
            .map(({ member, timeElapsed, key }) => {
                const isNew = usersToNotify.some(u => u.key === key);
                const globalName = member.user.globalName || member.user.username;
                const indicator = isNew ? '🆕' : '⏳';
                return `${indicator} <@${member.user.id}> (${globalName}) — **${formatDuration(timeElapsed)}**`;
            }).join('\n');

        // Crear embed
        const embed = new EmbedBuilder()
            .setTitle('📌 Usuarios en Sala de Espera')
            .setColor(hasNewUsers ? '#FF0000' : '#FFA500')
            .setDescription('Los siguientes usuarios están esperando atención en la sala de espera.')
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

        try {
            // Eliminar mensajes anteriores del bot
            const deletedCount = await deletePreviousBotMessages(channel, client.user.id);
            if (deletedCount > 0) {
                console.log(`🗑️ ${deletedCount} mensaje(s) anterior(es) eliminado(s) en ${guild.name}`);
            }

            // Enviar nuevo mensaje
            const sentMessage = await channel.send({
                content: hasNewUsers 
                    ? `🔔 **Atención ${roleMentions}**: Hay ${usersToNotify.length} nuevo${usersToNotify.length !== 1 ? 's' : ''} usuario${usersToNotify.length !== 1 ? 's' : ''} esperando.` 
                    : `📊 Actualización de usuarios en espera:`,
                embeds: [embed]
            });

            // Guardar referencia del mensaje enviado
            lastBotMessages.set(channel.id, sentMessage.id);

            // Marcar usuarios como notificados
            usersToNotify.forEach(u => notifiedUsers.add(u.key));

            console.log(`📢 [${new Date().toLocaleTimeString()}] Notificación enviada en ${guild.name}: ${users.length} usuario(s), ${usersToNotify.length} nuevo(s)`);

        } catch (error) {
            console.error(`❌ Error enviando notificación en ${guild.name}:`, error.message);
            
            // Si el error es por permisos, limpiar el caché
            if (error.code === 50013 || error.code === 50001) {
                cleanupDeletedMessages(channel.id);
            }
        }
    }
}

/**
 * Limpia el estado cuando alguien es atendido
 * Útil para llamar manualmente si es necesario
 * @param {string} guildId - ID del servidor
 * @param {string} userId - ID del usuario
 */
function markUserAsAttended(guildId, userId) {
    const key = `${guildId}-${userId}`;
    voiceStartTime.delete(key);
    notifiedUsers.delete(key);
    console.log(`✅ Usuario ${userId} marcado como atendido en ${guildId}`);
}

// Exportar funciones adicionales por si se necesitan
module.exports.markUserAsAttended = markUserAsAttended;
module.exports.cleanupDeletedMessages = cleanupDeletedMessages;