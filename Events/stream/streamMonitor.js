// Events/stream/streamMonitor.js
const { EmbedBuilder } = require('discord.js');
const streamAlertSchema = require('../../Models/streamAlertConfig');
const { checkStreamStatus } = require('../../utils/streamAPIs');

// Intervalo de verificación en milisegundos
const CHECK_INTERVAL = 10 * 60 * 1000; // 2 minutos

// Colores por plataforma
const PLATFORM_COLORS = {
    twitch: '#9146FF',
    kick: '#53FC18',
    tiktok: '#000000'
};

// Emojis por plataforma
const PLATFORM_EMOJIS = {
    twitch: '🟣',
    kick: '🟢',
    tiktok: '⚫'
};

// URLs por plataforma
const PLATFORM_URLS = {
    twitch: (username) => `https://twitch.tv/${username}`,
    kick: (username) => `https://kick.com/${username}`,
    tiktok: (username) => `https://tiktok.com/@${username}/live`
};

// Logos por defecto de plataformas
const PLATFORM_DEFAULT_AVATARS = {
    twitch: 'https://static-cdn.jtvnw.net/ttv-boxart/twitch-logo.png',
    kick: 'https://assets.kick.com/images/subcategories/1/cover/2bb3c7fd-ca99-4a35-8b40-35f2607c5b36',
    tiktok: 'https://sf16-website-login.neutral.ttwstatic.com/obj/tiktok_web_login_static/tiktok/webapp/main/webapp-desktop/8152caf0c8e8bc67ae0d.png'
};

/**
 * Inicializa el sistema de monitoreo de streams
 */
function initializeStreamMonitor(client) {
    if (client._streamAlertMonitorInitialized) {
        console.log('⚠️ [StreamMonitor] Ya está inicializado');
        return;
    }

    console.log('🎬 [StreamMonitor] Iniciando sistema de monitoreo...');

    // Ejecutar verificación inmediatamente
    checkAllGuilds(client);

    // Configurar intervalo de verificación
    setInterval(() => {
        checkAllGuilds(client);
    }, CHECK_INTERVAL);

    client._streamAlertMonitorInitialized = true;
    console.log(`✅ [StreamMonitor] Sistema iniciado (verificación cada ${CHECK_INTERVAL / 1000 / 60} minutos)`);
}

/**
 * Verifica todos los servidores con configuraciones activas
 */
async function checkAllGuilds(client) {
    try {
        const guildIds = client.guilds.cache.map(g => g.id);

        const configs = await streamAlertSchema.find({
            guildId: { $in: guildIds }
        });

        if (configs.length === 0) {
            console.log('📭 [StreamMonitor] No hay configuraciones activas');
            return;
        }

        console.log(`🔍 [StreamMonitor] Verificando ${configs.length} configuración(es)...`);

        for (const config of configs) {
            try {
                await checkAllStreams(client, config);
            } catch (error) {
                console.error(`❌ [StreamMonitor] Error en guild ${config.guildId}:`, error.message);
            }
        }

    } catch (error) {
        console.error('❌ [StreamMonitor] Error general:', error);
    }
}


/**
 * Verifica todos los streamers de una configuración
 */
async function checkAllStreams(client, config) {
    const guild = client.guilds.cache.get(config.guildId);
    if (!guild) {
        console.warn(`⚠️ [StreamMonitor] Guild ${config.guildId} no encontrado`);
        return { checked: 0, live: 0, notificationsSent: 0 };
    }

    const alertChannel = guild.channels.cache.get(config.alertChannelId);
    if (!alertChannel) {
        console.warn(`⚠️ [StreamMonitor] Canal de alertas no encontrado en ${guild.name}`);
        return { checked: 0, live: 0, notificationsSent: 0 };
    }

    let checked = 0;
    let live = 0;
    let notificationsSent = 0;

    for (const streamer of config.streamers) {
        if (!streamer.enabled) {
            console.log(`⏭️ [StreamMonitor] ${streamer.displayName}: Desactivado`);
            continue;
        }

        checked++;

        try {
            const streamData = await checkStreamStatus(
                streamer.platform,
                streamer.username
            );

            if (streamData.isLive) {
                live++;

                // Verificar keywords si es necesario
                if (config.settings.requireKeywords && config.globalKeywords.length > 0) {
                    const hasKeyword = config.globalKeywords.some(k =>
                        streamData.title?.toLowerCase().includes(k.keyword.toLowerCase())
                    );

                    if (!hasKeyword) {
                        console.log(`⏭️ [StreamMonitor] ${streamer.displayName}: Sin keywords, omitiendo`);
                        continue;
                    }
                }

                // Si ya estaba en vivo, actualizar mensaje
                if (streamer.isLive && streamer.lastMessageId) {
                    await updateStreamMessage(alertChannel, config, streamer, streamData);
                }
                // Si es nuevo stream, enviar notificación
                else if (!streamer.isLive) {
                    await sendStreamNotification(alertChannel, config, streamer, streamData);
                    notificationsSent++;

                    if (!streamer.stats) {
                        streamer.stats = { totalStreams: 0 };
                    }
                    streamer.stats.totalStreams++;
                    streamer.stats.lastStream = new Date();
                }

                // Actualizar datos
                streamer.isLive = true;
                streamer.lastLiveCheck = new Date();
                streamer.currentStreamTitle = streamData.title;
                streamer.currentViewers = streamData.viewers;
                streamer.streamStartedAt = streamData.startedAt ? new Date(streamData.startedAt) : null;

            } else {
                // Offline
                if (streamer.isLive && config.settings.autoDeleteMessages && streamer.lastMessageId) {
                    try {
                        const message = await alertChannel.messages.fetch(streamer.lastMessageId).catch(() => null);
                        if (message) {
                            await message.delete();
                            console.log(`🗑️ [StreamMonitor] Mensaje eliminado: ${streamer.displayName}`);
                        }
                    } catch (error) {
                        console.error(`❌ [StreamMonitor] Error eliminando mensaje:`, error);
                    }
                }

                streamer.isLive = false;
                streamer.lastMessageId = null;
                streamer.currentStreamTitle = null;
                streamer.currentViewers = 0;
                streamer.streamStartedAt = null;
            }

        } catch (error) {
            console.error(`❌ [StreamMonitor] Error verificando ${streamer.displayName}:`, error.message);
        }
    }

    if (!config.stats) {
        config.stats = { totalNotificationsSent: 0, lastCheck: null };
    }
    config.stats.lastCheck = new Date();
    await config.save();

    console.log(`✅ [StreamMonitor] ${guild.name}: ${checked} verificados, ${live} en vivo, ${notificationsSent} notificaciones`);

    return { checked, live, notificationsSent };
}

/**
 * Envía una notificación de nuevo stream
 */
async function sendStreamNotification(channel, config, streamer, streamData) {
    try {
        const platformEmoji = PLATFORM_EMOJIS[streamer.platform];
        const platformUrl = PLATFORM_URLS[streamer.platform](streamer.username);

        let message = streamer.customMessage || config.settings.defaultMessage;
        message = message.replace(/{streamer}/g, streamer.displayName);

        const embed = new EmbedBuilder()
            .setColor(PLATFORM_COLORS[streamer.platform])
            .setTitle(`${platformEmoji} ${streamer.displayName} está en vivo!`)
            .setURL(platformUrl)
            .setDescription(`**${streamData.title || 'Sin título'}**`)
            .addFields(
                { name: '🎮 Plataforma', value: streamer.platform.toUpperCase(), inline: true },
                { name: '👥 Viewers', value: `${streamData.viewers || 0}`, inline: true },
                { name: '🕐 Inicio', value: streamData.startedAt ? `<t:${Math.floor(new Date(streamData.startedAt).getTime() / 1000)}:R>` : 'N/A', inline: true }
            )
            .setTimestamp()
            .setFooter({ text: `🔴 EN VIVO • ${streamer.platform.toUpperCase()}` });

        // ===== CAMPOS ADICIONALES POR PLATAFORMA =====
        if (streamer.platform === 'twitch' && streamData.game) {
            embed.addFields({ name: '🎮 Juego', value: streamData.game, inline: true });
        }

        if (streamer.platform === 'kick' && streamData.categories?.length > 0) {
            embed.addFields({ name: '📂 Categorías', value: streamData.categories.join(', '), inline: true });
        }

    
        // ===== IMAGEN PRINCIPAL (captura del stream) =====
        if (streamer.platform === 'tiktok') {
            // Para TikTok: usar avatar como imagen principal si no hay thumbnail
            if (streamData.thumbnail) {
                embed.setImage(streamData.thumbnail);
            } else if (streamData.avatar) {
                embed.setImage(streamData.avatar);
            }
        } else {
            // Para Twitch y Kick: usar thumbnail del stream
            if (streamData.thumbnail) {
                embed.setImage(streamData.thumbnail);
            }
        }

        let content = message;
        if (streamer.roleId) {
            content = `<@&${streamer.roleId}> ${message}`;
        }

        const sentMessage = await channel.send({
            content,
            embeds: [embed]
        });

        streamer.lastMessageId = sentMessage.id;

        if (!config.stats) {
            config.stats = { totalNotificationsSent: 0 };
        }
        config.stats.totalNotificationsSent++;

        console.log(`📢 [StreamMonitor] Notificación enviada: ${streamer.displayName} (${streamer.platform})`);

    } catch (error) {
        console.error(`❌ [StreamMonitor] Error enviando notificación:`, error);
        throw error;
    }
}

/**
 * Actualiza el mensaje de un stream activo
 */
async function updateStreamMessage(channel, config, streamer, streamData) {
    try {
        const message = await channel.messages.fetch(streamer.lastMessageId).catch(() => null);

        if (!message) {
            console.log(`⚠️ [StreamMonitor] Mensaje no encontrado para ${streamer.displayName}, creando nuevo`);
            await sendStreamNotification(channel, config, streamer, streamData);
            return;
        }

        const platformEmoji = PLATFORM_EMOJIS[streamer.platform];
        const platformUrl = PLATFORM_URLS[streamer.platform](streamer.username);

        const embed = new EmbedBuilder()
            .setColor(PLATFORM_COLORS[streamer.platform])
            .setTitle(`${platformEmoji} ${streamer.displayName} está en vivo!`)
            .setURL(platformUrl)
            .setDescription(`**${streamData.title || 'Sin título'}**`)
            .addFields(
                { name: '🎮 Plataforma', value: streamer.platform.toUpperCase(), inline: true },
                { name: '👥 Viewers', value: `${streamData.viewers || 0}`, inline: true },
                { name: '🕐 Inicio', value: streamData.startedAt ? `<t:${Math.floor(new Date(streamData.startedAt).getTime() / 1000)}:R>` : 'N/A', inline: true }
            )
            .setTimestamp()
            .setFooter({ text: `🔴 EN VIVO • ${streamer.platform.toUpperCase()} • Actualizado` });

        // ===== CAMPOS ADICIONALES POR PLATAFORMA =====
        if (streamer.platform === 'twitch' && streamData.game) {
            embed.addFields({ name: '🎮 Juego', value: streamData.game, inline: true });
        }

        if (streamer.platform === 'kick' && streamData.categories?.length > 0) {
            embed.addFields({ name: '📂 Categorías', value: streamData.categories.join(', '), inline: true });
        }
  

        // ===== IMAGEN PRINCIPAL (captura del stream) =====
        if (streamer.platform === 'tiktok') {
            // Para TikTok: usar avatar como imagen principal si no hay thumbnail
            if (streamData.thumbnail) {
                embed.setImage(streamData.thumbnail);
            } else if (streamData.avatar) {
                embed.setImage(streamData.avatar);
            }
        } else {
            // Para Twitch y Kick: usar thumbnail del stream
            if (streamData.thumbnail) {
                embed.setImage(streamData.thumbnail);
            }
        }

        await message.edit({ embeds: [embed] });

        console.log(`🔄 [StreamMonitor] Mensaje actualizado: ${streamer.displayName}`);

    } catch (error) {
        console.error(`❌ [StreamMonitor] Error actualizando mensaje:`, error);
    }
}

module.exports = {
    initializeStreamMonitor,
    checkAllStreams
};
