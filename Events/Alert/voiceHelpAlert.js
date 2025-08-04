const { Events, EmbedBuilder, ChannelType } = require('discord.js');
const config = require('../../config.json');
const tabsStaffSchema = require('../../Models/tabsStaffSchema');

const voiceStartTime = new Map();
const notifiedUsers = new Set();

// Variables de configuración
const CHECK_INTERVAL = 10 * 1000;
const WAIT_THRESHOLD = 3 * 60 * 1000;

function formatDuration(ms) {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}m ${seconds}s`;
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

        if (!oldState.channel && newState.channel?.id === config.waitingRoomChannelId) {
            voiceStartTime.set(key, Date.now());
            console.log(`✅ [JOIN] ${username} entró a la sala de espera.`);
        }

        else if (oldState.channel?.id === config.waitingRoomChannelId && !newState.channel) {
            voiceStartTime.delete(key);
            notifiedUsers.delete(key);
            console.log(`📤 [LEAVE] ${username} salió del canal de voz.`);
        }

        else if (oldState.channel?.id !== newState.channel?.id) {
            if (oldState.channel?.id === config.waitingRoomChannelId) {
                voiceStartTime.delete(key);
                notifiedUsers.delete(key);
                console.log(`🔄 [OUT] ${username} cambió de canal desde la sala de espera.`);
            }
            if (newState.channel?.id === config.waitingRoomChannelId) {
                voiceStartTime.set(key, Date.now());
                console.log(`🔄 [IN] ${username} cambió de canal a la sala de espera.`);
            }
        }

        if (!client._monitorInitialized) {
            console.log('⏱️ Iniciando monitoreo de usuarios en sala de espera...');
            setInterval(() => checkWaitingUsers(client), CHECK_INTERVAL);
            client._monitorInitialized = true;
        }
    }
};

/**
 * Verifica periódicamente qué usuarios han pasado el umbral de espera
 * y envía una notificación al canal del staff.
 */
async function checkWaitingUsers(client) {
    const now = Date.now();
    const guildMap = new Map();

    for (const [key, startTime] of voiceStartTime.entries()) {
        const [guildId, userId] = key.split('-');
        const guild = client.guilds.cache.get(guildId);
        if (!guild) continue;

        const member = guild.members.cache.get(userId);
        if (!member?.voice.channel || member.voice.channel.id !== config.waitingRoomChannelId) {
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

    for (const [guildId, users] of guildMap.entries()) {
        const guild = client.guilds.cache.get(guildId);
        const channel = guild.channels.cache.get(config.staffAlertChannel);
        if (!channel || channel.type !== ChannelType.GuildText) continue;

        const usersToNotify = users.filter(u => !notifiedUsers.has(u.key));
        if (usersToNotify.length === 0) continue;

        let roleMentions = `<@&${config.pingRolStaff}>`;

        const list = users.map(({ member, timeElapsed }) => {
            const isNew = usersToNotify.some(u => u.key === `${guildId}-${member.user.id}`);
            const globalName = member.user.globalName || member.user.username;
            return `${isNew ? '🆕 ' : '⏳ '} <@${member.user.id}> (${globalName}) — ${formatDuration(timeElapsed)}`;
        }).join('\n');

        const embed = new EmbedBuilder()
            .setTitle('📌 Usuarios en Sala de Espera')
            .setColor('#FF0000')
            .setDescription('Se ha detectado que los siguientes usuarios llevan un tiempo considerable esperando en la sala de espera.')
            .addFields({ name: `👥 Total: ${users.length}`, value: list })
            .setFooter({ text: `Servidor: ${guild.name}`, iconURL: guild.iconURL({ dynamic: true }) })
            .setTimestamp();

        try {
            await channel.send({
                content: `🔔 Estimado equipo, les informamos que hay miembros esperando atención en la sala de espera. ||${roleMentions}||`,
                embeds: [embed]
            });
            usersToNotify.forEach(u => notifiedUsers.add(u.key));
            console.log(`📢 Notificados en ${guild.name}: ${usersToNotify.length} usuarios.`);
        } catch (e) {
            console.error(`❌ Error notificando en ${guild.name}:`, e.message);
        }
    }
}