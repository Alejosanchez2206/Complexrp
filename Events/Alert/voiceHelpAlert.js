const { Events, EmbedBuilder } = require('discord.js');
const config = require('../../config.json');

const voiceStartTime = new Map();
const notifiedUsers = new Set(); // Contiene llaves tipo `${guildId}-${userId}`

const CHECK_INTERVAL = 1 * 60 * 1000; // 1 minuto
const WAIT_THRESHOLD = 10 * 60 * 1000; // 10 minutos

function formatDuration(ms) {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes} minuto(s), ${seconds} segundo(s)`;
}

module.exports = (client) => {
    client.on(Events.VoiceStateUpdate, (oldState, newState) => {
        const userId = newState.member.user.id;
        const guildId = newState.guild.id;
        const key = `${guildId}-${userId}`;

        // Usuario se une
        if (!oldState.channel && newState.channel) {
            voiceStartTime.set(key, Date.now());
        }

        // Usuario sale del canal de voz
        else if (oldState.channel && !newState.channel) {
            voiceStartTime.delete(key);
            notifiedUsers.delete(key); // Reiniciar notificación
        }
    });

    setInterval(async () => {
        const now = Date.now();
        const guildMap = new Map();
        const newNotified = [];

        for (const [key, startTime] of voiceStartTime.entries()) {
            const [guildId, userId] = key.split('-');
            const guild = client.guilds.cache.get(guildId);
            if (!guild) continue;

            const member = guild.members.cache.get(userId);
            if (!member || !member.voice.channel) {
                voiceStartTime.delete(key);
                notifiedUsers.delete(key);
                continue;
            }

            if (config.waitingRoomChannelId && member.voice.channel.id !== config.waitingRoomChannelId) {
                continue;
            }

            const timeElapsed = now - startTime;
            if (timeElapsed < WAIT_THRESHOLD) continue;

            if (!guildMap.has(guildId)) {
                guildMap.set(guildId, []);
            }

            // Si el usuario aún no ha sido notificado, marcarlo como nuevo
            if (!notifiedUsers.has(key)) {
                newNotified.push(key);
            }

            guildMap.get(guildId).push({ member, timeElapsed, key });
        }

        for (const [guildId, users] of guildMap.entries()) {
            // Verificar si hay usuarios nuevos para notificar
            const hasNewUsers = users.some(u => newNotified.includes(u.key));
            if (!hasNewUsers) continue;

            const guild = client.guilds.cache.get(guildId);
            const logChannel = guild.channels.cache.get(config.staffAlertChannel);
            if (!logChannel) continue;

            const userList = users.map(({ member, timeElapsed }) => {
                return `• ${member.user.tag} — ${formatDuration(timeElapsed)} en espera.`;
            }).join('\n');

            const embed = new EmbedBuilder()
                .setTitle('🕒 Atención requerida: Usuario(s) en Sala de Espera')
                .setColor('#FFA500')
                .setDescription(
                    'Se ha detectado que uno o más usuarios han permanecido en la **sala de espera** durante más de 10 minutos.\n\n' +
                    'Tu atención puede marcar una gran diferencia para su experiencia en el servidor.'
                )
                .addFields(
                    {
                        name: '👥 Usuarios en Espera (+10 min)',
                        value: userList,
                        inline: false
                    },
                    {
                        name: '📌 Recomendación',
                        value: 'Te invitamos cordialmente a revisar su situación y brindarles el apoyo necesario. \n' +
                            'Una atención oportuna fortalece nuestra comunidad y demuestra nuestro compromiso con todos los miembros.',
                        inline: false
                    }
                )
                .setTimestamp()
                .setFooter({
                    text: `Servidor: ${guild.name}`,
                    iconURL: guild.iconURL({ dynamic: true })
                });

            try {
                await logChannel.send({
                    content: `@everyone Usuarios en sala de espera por más de 10 minutos.`,
                    embeds: [embed]
                });

                // Marcar como notificados
                for (const { key } of users) {
                    notifiedUsers.add(key);
                }
            } catch (error) {
                console.error(`Error al enviar alerta en ${guild.name}:`, error);
            }
        }
    }, CHECK_INTERVAL);
};
