const { Events, EmbedBuilder, ChannelType } = require('discord.js');
const config = require('../../config.json');
const tabsStaffSchema = require('../../Models/tabsStaffSchema');

// Mapas de control
const voiceStartTime = new Map();
const notifiedUsers = new Set();

// Configuración
const CHECK_INTERVAL = 10 * 1000;
const WAIT_THRESHOLD = 3 * 60 * 1000; // 3 minutos

function formatDuration(ms) {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}m ${seconds}s`;
}

module.exports = {
    name: Events.VoiceStateUpdate,
    once: false,

    async execute(oldState, newState, client) {
        const user = newState.member?.user;
        if (!user) return;

        const userId = user.id;
        const guildId = newState.guild.id;
        const key = `${guildId}-${userId}`;
        const username = user.tag;

        // Usuario entra a la sala de espera
        if (!oldState.channel && newState.channel?.id === config.waitingRoomChannelId) {
            voiceStartTime.set(key, Date.now());
            console.log(`✅ [JOIN] ${username} entró a la sala de espera.`);
        }

        // Usuario sale del servidor por completo o de la sala de espera
        else if (oldState.channel?.id === config.waitingRoomChannelId && !newState.channel) {
            voiceStartTime.delete(key);
            notifiedUsers.delete(key);
            console.log(`📤 [LEAVE] ${username} salió del canal de voz.`);
        }

        // Cambia de canal
        else if (oldState.channel?.id !== newState.channel?.id) {
            if (oldState.channel?.id === config.waitingRoomChannelId) {
                voiceStartTime.delete(key);
                notifiedUsers.delete(key);
                console.log(`🔄 [OUT] ${username} salió de la sala de espera.`);
            }
            if (newState.channel?.id === config.waitingRoomChannelId) {
                voiceStartTime.set(key, Date.now());
                console.log(`🔄 [IN] ${username} entró de nuevo a la sala de espera.`);
            }
        }

        // Iniciar monitor una sola vez
        if (!client._monitorInitialized) {
            console.log('⏱️ Iniciando monitoreo de sala de espera...');
            setInterval(() => checkWaitingUsers(client), CHECK_INTERVAL);
            client._monitorInitialized = true;
        }
    }
};

/** -----------------------------------------------------------------------------------
 * 🔎 MONITOR DE USUARIOS ESPERANDO
 ----------------------------------------------------------------------------------- **/
async function checkWaitingUsers(client) {
    const now = Date.now();
    const guildMap = new Map();

    for (const [key, startTime] of voiceStartTime.entries()) {
        const [guildId, userId] = key.split('-');

        const guild = client.guilds.cache.get(guildId);
        if (!guild) continue;

        const member = guild.members.cache.get(userId);
        if (!member?.voice?.channel || member.voice.channel.id !== config.waitingRoomChannelId) {
            voiceStartTime.delete(key);
            notifiedUsers.delete(key);
            continue;
        }

        const timeElapsed = now - startTime;

        if (timeElapsed >= WAIT_THRESHOLD) {
            if (!guildMap.has(guildId)) guildMap.set(guildId, []);
            guildMap.get(guildId).push({ member, timeElapsed, key });
        }
    }

    // Enviar alertas
    for (const [guildId, users] of guildMap.entries()) {
        const guild = client.guilds.cache.get(guildId);
        const channel = guild.channels.cache.get(config.staffAlertChannel);

        if (!channel || channel.type !== ChannelType.GuildText) continue;

        // Usuarios nuevos que deben generar ping
        const usersToNotify = users.filter(u => !notifiedUsers.has(u.key));
        if (usersToNotify.length === 0) continue;

        /** 🧹 ELIMINAR MENSAJES ANTERIORES DEL BOT */
        try {
            const messages = await channel.messages.fetch({ limit: 50 });
            const botMessages = messages.filter(m => m.author.id === client.user.id);

            if (botMessages.size > 0) {
                await channel.bulkDelete(botMessages, true);
                console.log(`🧹 Eliminados ${botMessages.size} mensajes anteriores del bot.`);
            }
        } catch (err) {
            console.error(`❌ Error borrando mensajes del bot: ${err.message}`);
        }

        /** 📌 CREAR MESSAGE EMBED */
        const list = users.map(({ member, timeElapsed }) => {
            const isNew = usersToNotify.some(u => u.key === `${guildId}-${member.user.id}`);
            const globalName = member.user.globalName || member.user.username;
            return `${isNew ? '🆕' : '⏳'} <@${member.user.id}> (${globalName}) — ${formatDuration(timeElapsed)}`;
        }).join('\n');

        const embed = new EmbedBuilder()
            .setTitle('📌 Usuarios esperando atención')
            .setColor('#FF0000')
            .setDescription('Los siguientes miembros llevan un tiempo considerable en la sala de espera:')
            .addFields({ name: `👥 Total: ${users.length}`, value: list })
            .setFooter({ text: `Servidor: ${guild.name}`, iconURL: guild.iconURL({ dynamic: true }) })
            .setTimestamp();

        /** 📢 ENVIAR MENSAJE */
        try {
            await channel.send({
                content: `🔔 Atención equipo de staff ||<@&${config.pingRolStaff}>||`,
                embeds: [embed]
            });

            // Marcar como notificados
            usersToNotify.forEach(u => notifiedUsers.add(u.key));

            console.log(`📢 Notificados ${usersToNotify.length} usuarios en ${guild.name}.`);
        } catch (e) {
            console.error(`❌ Error enviando alerta: ${e.message}`);
        }
    }
}
