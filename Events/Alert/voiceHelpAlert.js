// events/voiceWaitingRoom.js
const { Events, EmbedBuilder, ChannelType } = require('discord.js');
const config = require('../../config.json');

// Mapas de control
const voiceStartTime = new Map(); // Cuando entraron a la sala
const notifiedUsers = new Set(); // Usuarios que ya fueron notificados
const lastAlertTime = new Map(); // Última vez que se envió alerta por guild

// Configuración
const CHECK_INTERVAL = 30 * 1000; // Revisar cada 30 segundos
const WAIT_THRESHOLD = 3 * 60 * 1000; // 3 minutos de espera
const ALERT_COOLDOWN = 3 * 60 * 1000; // Solo alertar cada 3 minutos
const MAX_MESSAGES_TO_DELETE = 50; // Aumentado para limpiar mejor

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
            
            // Limpiar datos del usuario
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
                
                // Limpiar datos del usuario
                voiceStartTime.delete(key);
                notifiedUsers.delete(key);
            }
            
            if (newState.channel?.id === config.waitingRoomChannelId) {
                voiceStartTime.set(key, Date.now());
                console.log(`🔄 [IN] ${username} entró a la sala de espera a las ${new Date().toLocaleTimeString()}`);
            }
        }

        // Iniciar monitor una sola vez
        if (!client._waitingRoomMonitorInitialized) {
            console.log('⏱️ Iniciando monitoreo de sala de espera...');
            console.log(`📊 Configuración:`);
            console.log(`   - Intervalo de revisión: ${CHECK_INTERVAL / 1000}s`);
            console.log(`   - Umbral de espera: ${WAIT_THRESHOLD / 1000}s (${WAIT_THRESHOLD / 60000} minutos)`);
            console.log(`   - Cooldown de alertas: ${ALERT_COOLDOWN / 60000} minutos`);
            
            setInterval(() => checkWaitingUsers(client), CHECK_INTERVAL);
            client._waitingRoomMonitorInitialized = true;
        }
    }
};

/**
 * Verifica usuarios esperando y envía notificaciones SOLO si hay nuevos usuarios
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
        
        // Validar que el usuario sigue en la sala de espera
        if (!member?.voice?.channel || member.voice.channel.id !== config.waitingRoomChannelId) {
            voiceStartTime.delete(key);
            notifiedUsers.delete(key);
            continue;
        }

        const timeElapsed = now - startTime;

        // Solo considerar usuarios que han esperado más del umbral
        if (timeElapsed >= WAIT_THRESHOLD) {
            if (!guildMap.has(guildId)) {
                guildMap.set(guildId, []);
            }
            guildMap.get(guildId).push({ 
                member, 
                timeElapsed, 
                key, 
                startTime,
                isNew: !notifiedUsers.has(key)
            });
        }
    }

    // Si no hay usuarios esperando, retornar
    if (guildMap.size === 0) return;

    // Procesar cada guild
    for (const [guildId, users] of guildMap.entries()) {
        const guild = client.guilds.cache.get(guildId);
        const channel = guild.channels.cache.get(config.staffAlertChannel);

        if (!channel || channel.type !== ChannelType.GuildText) {
            console.warn(`⚠️ Canal de alertas no encontrado en ${guild.name}`);
            continue;
        }

        // Verificar permisos del bot
        const botPermissions = channel.permissionsFor(guild.members.me);
        if (!botPermissions.has(['SendMessages', 'ViewChannel', 'ManageMessages'])) {
            console.error(`❌ Permisos insuficientes en ${channel.name}`);
            continue;
        }

        // Identificar usuarios nuevos (no notificados)
        const newUsers = users.filter(u => u.isNew);

        // ===== REGLA PRINCIPAL: SOLO ALERTAR SI HAY NUEVOS USUARIOS =====
        if (newUsers.length === 0) {
            console.log(`⏭️ [${guild.name}] No hay nuevos usuarios, omitiendo alerta`);
            continue;
        }

        // Verificar cooldown de alertas (3 minutos entre alertas)
        const lastAlert = lastAlertTime.get(guildId) || 0;
        const timeSinceLastAlert = now - lastAlert;
        
        if (timeSinceLastAlert < ALERT_COOLDOWN) {
            const remainingTime = Math.ceil((ALERT_COOLDOWN - timeSinceLastAlert) / 1000);
            console.log(`⏳ [${guild.name}] Cooldown activo. Esperando ${remainingTime}s más`);
            continue;
        }

        // ===== LIMPIAR MENSAJES ANTERIORES DEL BOT =====
        try {
            const messages = await channel.messages.fetch({ limit: MAX_MESSAGES_TO_DELETE });
            const botMessages = messages.filter(msg => 
                msg.author.id === client.user.id && 
                (
                    (msg.embeds.length > 0 && msg.embeds[0].title?.includes('esperando atención')) ||
                    msg.content.includes('Atención') ||
                    msg.content.includes('usuarios en espera')
                )
            );

            if (botMessages.size > 0) {
                await channel.bulkDelete(botMessages, true).catch(err => {
                    console.warn(`⚠️ No se pudieron borrar mensajes en bulk, borrando individualmente...`);
                    botMessages.forEach(msg => msg.delete().catch(() => {}));
                });
                console.log(`🗑️ ${botMessages.size} mensaje(s) anterior(es) eliminado(s) en ${guild.name}`);
            }
        } catch (error) {
            if (error.code !== 10008) { // Ignorar error de mensaje ya eliminado
                console.warn(`⚠️ Error al limpiar mensajes: ${error.message}`);
            }
        }

        // ===== CREAR EMBED DE ALERTA =====
        const sortedUsers = users.sort((a, b) => b.timeElapsed - a.timeElapsed);
        
        const userList = sortedUsers.map(({ member, timeElapsed, isNew }) => {
            const globalName = member.user.globalName || member.user.username;
            const indicator = isNew ? '🆕' : '⏳';
            return `${indicator} ${member} (${globalName}) — **${formatDuration(timeElapsed)}**`;
        }).join('\n');

        const embed = new EmbedBuilder()
            .setTitle('📌 Usuarios esperando atención')
            .setColor('#FF0000') // Rojo porque hay nuevos usuarios
            .setDescription('⚠️ **Nuevos usuarios esperando en la sala de voz**')
            .addFields({
                name: `👥 Total: ${users.length} usuario${users.length !== 1 ? 's' : ''} (${newUsers.length} nuevo${newUsers.length !== 1 ? 's' : ''})`,
                value: userList || 'No hay usuarios en espera.',
                inline: false
            })
            .addFields({
                name: '📊 Estadísticas',
                value: `**Tiempo promedio:** ${formatDuration(users.reduce((sum, u) => sum + u.timeElapsed, 0) / users.length)}\n` +
                       `**Tiempo máximo:** ${formatDuration(Math.max(...users.map(u => u.timeElapsed)))}`,
                inline: false
            })
            .setFooter({
                text: `${guild.name} • Alertas cada ${ALERT_COOLDOWN / 60000} minutos`,
                iconURL: guild.iconURL({ dynamic: true })
            })
            .setTimestamp();

        // ===== ENVIAR ALERTA =====
        try {
            const roleMention = config.pingRolStaff ? `<@&${config.pingRolStaff}>` : '@Staff';
            
            await channel.send({
                content: `🔔 **Atención ${roleMention}**: ${newUsers.length} nuevo${newUsers.length !== 1 ? 's' : ''} usuario${newUsers.length !== 1 ? 's' : ''} esperando en la sala de voz.`,
                embeds: [embed]
            });

            // Actualizar tiempo de última alerta
            lastAlertTime.set(guildId, now);

            // Marcar TODOS los usuarios como notificados
            users.forEach(u => notifiedUsers.add(u.key));

            console.log(`📢 [${new Date().toLocaleTimeString()}] 🔔 ALERTA enviada en ${guild.name}:`);
            console.log(`   - Total de usuarios: ${users.length}`);
            console.log(`   - Nuevos usuarios: ${newUsers.length}`);
            console.log(`   - Usuarios: ${users.map(u => u.member.user.tag).join(', ')}`);

        } catch (error) {
            console.error(`❌ Error enviando alerta en ${guild.name}:`, error.message);
        }
    }
}