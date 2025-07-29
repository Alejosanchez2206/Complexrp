const { Events, EmbedBuilder } = require('discord.js');
const config = require('../../config.json');

const voiceStartTime = new Map();
const notifiedUsers = new Set();

const CHECK_INTERVAL = 1 * 60 * 1000;
const WAIT_THRESHOLD = 10 * 60 * 1000;

function formatDuration(ms) {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes} minuto(s), ${seconds} segundo(s)`;
}

module.exports = (client) => {
    if (!config.waitingRoomChannelId) {
        console.warn('⚠️ waitingRoomChannelId no está configurado en config.json');
    }
    if (!config.staffAlertChannel) {
        console.warn('⚠️ staffAlertChannel no está configurado en config.json');
    }

    client.on(Events.VoiceStateUpdate, (oldState, newState) => {
        const userId = newState.member.user.id;
        const guildId = newState.guild.id;
        const key = `${guildId}-${userId}`;

        if (!oldState.channel && newState.channel) {
            if (!config.waitingRoomChannelId || newState.channel.id === config.waitingRoomChannelId) {
                voiceStartTime.set(key, Date.now());
                console.log(`👤 ${newState.member.user.tag} se unió a la sala de espera: ${newState.channel.name}`);
            } else {
                console.log(`👤 ${newState.member.user.tag} se unió al canal: ${newState.channel.name} (no es sala de espera)`);
            }
        }

        else if (oldState.channel && !newState.channel) {
            voiceStartTime.delete(key);
            notifiedUsers.delete(key);
            console.log(`👤 ${oldState.member.user.tag} salió completamente del canal de voz`);
        }


        else if (oldState.channel && newState.channel && oldState.channel.id !== newState.channel.id) {


            if (config.waitingRoomChannelId && oldState.channel.id === config.waitingRoomChannelId) {
                voiceStartTime.delete(key);
                notifiedUsers.delete(key);
                console.log(`👤 ${newState.member.user.tag} salió de la sala de espera hacia: ${newState.channel.name}`);
            }


            else if (config.waitingRoomChannelId && newState.channel.id === config.waitingRoomChannelId) {
                if (!voiceStartTime.has(key)) {
                    voiceStartTime.set(key, Date.now());
                    console.log(`👤 ${newState.member.user.tag} entró a la sala de espera desde: ${oldState.channel.name}`);
                } else {
                    console.log(`👤 ${newState.member.user.tag} ya estaba siendo monitoreado, manteniendo tiempo original`);
                }
            }

            else {
                console.log(`👤 ${newState.member.user.tag} cambió de ${oldState.channel.name} a ${newState.channel.name}`);
            }
        }
    });

    setInterval(async () => {
        const now = Date.now();
        const guildMap = new Map();

        console.log(`🔍 Verificando usuarios en espera... (${voiceStartTime.size} usuarios monitoreados)`);

        for (const [key, startTime] of voiceStartTime.entries()) {
            const [guildId, userId] = key.split('-');
            const guild = client.guilds.cache.get(guildId);
            if (!guild) {
                console.warn(`⚠️ Servidor no encontrado: ${guildId}`);
                voiceStartTime.delete(key);
                notifiedUsers.delete(key);
                continue;
            }

            const member = guild.members.cache.get(userId);
            if (!member || !member.voice.channel) {
                console.log(`👤 Usuario ${userId} ya no está en canal de voz, removiendo del monitoreo`);
                voiceStartTime.delete(key);
                notifiedUsers.delete(key);
                continue;
            }

            const shouldMonitor = !config.waitingRoomChannelId || member.voice.channel.id === config.waitingRoomChannelId;

            if (!shouldMonitor) {
                console.log(`👤 ${member.user.tag} ya no está en sala de espera, removiendo del monitoreo`);
                voiceStartTime.delete(key);
                notifiedUsers.delete(key);
                continue;
            }

            const timeElapsed = now - startTime;
            if (timeElapsed < WAIT_THRESHOLD) continue;

            if (!guildMap.has(guildId)) {
                guildMap.set(guildId, []);
            }

            guildMap.get(guildId).push({ member, timeElapsed, key });
        }


        for (const [guildId, users] of guildMap.entries()) {
            const usersToNotify = users.filter(u => !notifiedUsers.has(u.key));

            if (usersToNotify.length === 0) {
                console.log(`ℹ️ No hay usuarios nuevos para notificar en servidor ${guildId}`);
                continue;
            }

            const guild = client.guilds.cache.get(guildId);
            const logChannel = guild.channels.cache.get(config.staffAlertChannel);

            if (!logChannel) {
                console.error(`❌ Canal de alertas no encontrado en ${guild.name}. ID configurado: ${config.staffAlertChannel}`);
                continue;
            }

            const allUsersList = users.map(({ member, timeElapsed }) => {
                const isNew = usersToNotify.some(u => u.key === `${guildId}-${member.user.id}`);
                const indicator = isNew ? '🆕' : '⏳';
                return `${indicator} ${member.user.tag} — ${formatDuration(timeElapsed)} en espera.`;
            }).join('\n');

            const newUsersList = usersToNotify.map(({ member, timeElapsed }) => {
                return `• ${member.user.tag} — ${formatDuration(timeElapsed)}`;
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
                        name: `👥 Todos los usuarios en espera (+10 min) [${users.length}]`,
                        value: allUsersList || 'Ninguno',
                        inline: false
                    }
                )
                .setTimestamp()
                .setFooter({
                    text: `Servidor: ${guild.name} | Nuevos: ${usersToNotify.length}`,
                    iconURL: guild.iconURL({ dynamic: true })
                });


            if (users.length > usersToNotify.length) {
                embed.addFields({
                    name: `🆕 Usuarios recién detectados [${usersToNotify.length}]`,
                    value: newUsersList,
                    inline: false
                });
            }

            embed.addFields({
                name: '📌 Recomendación',
                value: 'Te invitamos cordialmente a revisar su situación y brindarles el apoyo necesario. \n' +
                    'Una atención oportuna fortalece nuestra comunidad y demuestra nuestro compromiso con todos los miembros.',
                inline: false
            });

            try {
                console.log(`📤 Enviando notificación para ${usersToNotify.length} usuario(s) en ${guild.name}`);

                await logChannel.send({
                    content: `@everyone Usuarios en sala de espera por más de 10 minutos.`,
                    embeds: [embed]
                });

                for (const { key } of usersToNotify) {
                    notifiedUsers.add(key);
                }
                console.log(`✅ Notificación enviada exitosamente en ${guild.name}`);
            } catch (error) {
                console.error(`❌ Error al enviar alerta en ${guild.name}:`, error);
            }
        }
    }, CHECK_INTERVAL);

    setInterval(() => {
        console.log(`📊 Estado del monitor: ${voiceStartTime.size} usuarios monitoreados, ${notifiedUsers.size} notificados`);
    }, 5 * 60 * 1000);
};