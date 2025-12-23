// utils/streamAPIs.js
const axios = require('axios');
const { HttpsProxyAgent } = require('https-proxy-agent');


let twitchAccessToken = null;
let twitchTokenExpiry = null;
let kickAccessToken = null;
let kickTokenExpiry = null;

const config = require('../config.json');

/**
 * Verifica el estado de un stream según la plataforma
 */
async function checkStreamStatus(platform, username) {
    switch (platform) {
        case 'twitch':
            return await checkTwitchStream(username);
        case 'kick':
            return await checkKickStream(username);
        case 'tiktok':
            return await checkTikTokStream(username);
        default:
            throw new Error(`Plataforma no soportada: ${platform}`);
    }
}

// ==================== TWITCH ====================

async function getTwitchAccessToken() {
    if (twitchAccessToken && twitchTokenExpiry && Date.now() < twitchTokenExpiry) {
        return twitchAccessToken;
    }

    const clientId = config.apiKeys?.twitchClientId;
    const clientSecret = config.apiKeys?.twitchClientSecret;

    if (!clientId || !clientSecret) {
        throw new Error('API keys de Twitch no configuradas');
    }

    try {
        const response = await axios.post('https://id.twitch.tv/oauth2/token', null, {
            params: {
                client_id: clientId,
                client_secret: clientSecret,
                grant_type: 'client_credentials'
            }
        });

        twitchAccessToken = response.data.access_token;
        twitchTokenExpiry = Date.now() + (response.data.expires_in * 1000) - 60000;

        console.log('✅ Token de Twitch obtenido exitosamente');
        return twitchAccessToken;

    } catch (error) {
        console.error('❌ Error obteniendo token de Twitch:', error.response?.data || error.message);
        throw new Error('No se pudo obtener el token de Twitch');
    }
}

async function checkTwitchStream(username) {
    try {
        const token = await getTwitchAccessToken();
        const clientId = config.apiKeys.twitchClientId;

        const userResponse = await axios.get('https://api.twitch.tv/helix/users', {
            params: { login: username },
            headers: {
                'Client-ID': clientId,
                'Authorization': `Bearer ${token}`
            }
        });

        if (!userResponse.data.data || userResponse.data.data.length === 0) {
            throw new Error(`Usuario de Twitch no encontrado: ${username}`);
        }

        const userId = userResponse.data.data[0].id;
        const avatar = userResponse.data.data[0].profile_image_url;

        const streamResponse = await axios.get('https://api.twitch.tv/helix/streams', {
            params: { user_id: userId },
            headers: {
                'Client-ID': clientId,
                'Authorization': `Bearer ${token}`
            }
        });

        const streamData = streamResponse.data.data[0];

        if (!streamData) {
            return {
                isLive: false,
                platform: 'twitch',
                username
            };
        }

        const streamThumbnail = streamData.thumbnail_url
            .replace('{width}', '1920')
            .replace('{height}', '1080') + `?t=${Date.now()}`;

        return {
            isLive: true,
            platform: 'twitch',
            username,
            title: streamData.title,
            viewers: streamData.viewer_count,
            startedAt: streamData.started_at,
            thumbnail: streamThumbnail,
            avatar: avatar,
            game: streamData.game_name,
            language: streamData.language
        };

    } catch (error) {
        console.error(`❌ [Twitch] Error verificando stream (${username}):`, error.message);
        throw error;
    }
}

// ==================== KICK (API OFICIAL) ====================

/**
 * Obtiene un token de acceso de Kick (OAuth 2.1 client_credentials)
 * POST https://id.kick.com/oauth/token?grant_type=client_credentials&client_id=...&client_secret=...
 */
async function getKickAccessToken() {
    if (kickAccessToken && kickTokenExpiry && Date.now() < kickTokenExpiry) {
        return kickAccessToken;
    }

    const clientId = config.apiKeys?.kickClientId;
    const clientSecret = config.apiKeys?.kickClientSecret;

    if (!clientId || !clientSecret) {
        throw new Error('API keys de Kick no configuradas');
    }

    try {
        const response = await axios.post('https://id.kick.com/oauth/token', null, {
            params: {
                grant_type: 'client_credentials',
                client_id: clientId,
                client_secret: clientSecret
            },
            headers: {
                'Accept': 'application/json'
            }
        });

        kickAccessToken = response.data.access_token;
        kickTokenExpiry = Date.now() + (response.data.expires_in * 1000) - 60000;

        console.log('✅ Token de Kick obtenido exitosamente');
        return kickAccessToken;

    } catch (error) {
        console.error('❌ Error obteniendo token de Kick:', error.response?.data || error.message);
        throw new Error('No se pudo obtener el token de Kick');
    }
}

/**
 * Obtiene info de canal de Kick a partir del slug (username)
 * Intenta múltiples endpoints para mayor compatibilidad
 */
async function getKickChannelInfo(username) {
    const token = await getKickAccessToken();

    const res = await axios.get('https://api.kick.com/public/v1/channels', {
        params: { slug: username },
        headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/json'
        },
        timeout: 10000
    });

    console.log('[Kick debug] /channels raw response:', res.data);

    // En tu caso la estructura es { data: [ { broadcaster_user_id, slug, ... } ], message: 'OK' }
    const items = res.data.data || res.data.channels || res.data;

    if (!items || !Array.isArray(items) || items.length === 0) {
        throw new Error(`Canal de Kick no encontrado en /channels: ${username}`);
    }

    const ch = items[0];

    const broadcasterUserId = ch.broadcaster_user_id;
    if (!broadcasterUserId) {
        throw new Error(
            `Canal de Kick sin broadcaster_user_id: ${username} (objeto: ${JSON.stringify(ch)})`
        );
    }

    console.log(
        `[Kick debug] Canal encontrado: slug=${ch.slug || username}, broadcaster_user_id=${broadcasterUserId}`
    );

    return {
        broadcasterUserId,
        channelId: ch.id || broadcasterUserId,
        avatar: ch.user?.profile_pic || ch.profile_pic || null,
        slug: ch.slug || username
    };
}


/**
 * Verifica si un canal de Kick está en vivo usando /public/v1/livestreams
 * GET https://api.kick.com/public/v1/livestreams?broadcaster_user_id=<id>
 */
async function checkKickStream(username) {
    try {
        const channelInfo = await getKickChannelInfo(username);

        const token = await getKickAccessToken();

        const res = await axios.get('https://api.kick.com/public/v1/livestreams', {
            params: { broadcaster_user_id: channelInfo.broadcasterUserId },
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: 'application/json'
            },
            timeout: 10000
        });

        console.log('[Kick debug] /livestreams raw response:', JSON.stringify(res.data, null, 2));

        const streams = res.data.livestreams || res.data.data || res.data;
        if (!streams || streams.length === 0) {
            return {
                isLive: false,
                platform: 'kick',
                username
            };
        }

        const s = streams[0];

        let streamThumbnail = null;
        // Manejo seguro de thumbnail con múltiples posibles estructuras
        if (s.thumbnail?.url) {
            streamThumbnail = s.thumbnail.url + `?t=${Date.now()}`;
        } else if (typeof s.thumbnail === 'string') {
            streamThumbnail = s.thumbnail + `?t=${Date.now()}`;
        } else if (s.stream_thumbnail) {
            streamThumbnail = s.stream_thumbnail + `?t=${Date.now()}`;
        } else if (s.preview_thumbnail) {
            streamThumbnail = s.preview_thumbnail + `?t=${Date.now()}`;
        }

        console.log(`✅ [Kick] ${username}: EN VIVO (${s.viewer_count || 0} viewers)`);

        return {
            isLive: true,
            platform: 'kick',
            username,
            title: s.stream_title || s.title || 'Sin título',
            viewers: s.viewer_count || s.viewers || 0,
            startedAt: s.started_at || s.created_at,
            thumbnail: streamThumbnail,
            avatar: channelInfo.avatar,
            categories: s.categories?.map(c => c.name) || [],
            language: s.language || null,
            channelId: channelInfo.channelId
        };

    } catch (error) {
        console.error(`❌ [Kick] Error verificando stream (${username}):`, error.message);
        return {
            isLive: false,
            platform: 'kick',
            username,
            error: error.message
        };
    }
}



// ==================== TIKTOK ====================

async function checkTikTokStream(username) {
    try {
        const response = await axios.get(`https://www.tiktok.com/@${username}/live`, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9'
            },
            maxRedirects: 5,
            timeout: 10000
        });

        const html = response.data;

        // ===== 1. OBTENER VALORES CRÍTICOS DEL HTML =====
        const titleTagMatch = html.match(/<title>([^<]+)<\/title>/i);
        const pageTitle = titleTagMatch ? titleTagMatch[1] : '';
        const isLiveByTitle = /is LIVE - TikTok LIVE/i.test(pageTitle);

        const hasLiveRoom = /"LiveRoom"/i.test(html);
        const isLiveFlag =
            /"is_live"\s*:\s*true/i.test(html) ||
            /"isLive"\s*:\s*true/i.test(html);

        const statusMatch = html.match(/"status"\s*:\s*(\d+)/i);
        const statusCode = statusMatch ? parseInt(statusMatch[1], 10) : null;

        const viewersMatch =
            html.match(/"viewerCount["\s:]+(\d+)/i) ||
            html.match(/"userCount["\s:]+(\d+)/i);
        const rawViewers = viewersMatch ? parseInt(viewersMatch[1], 10) : 0;

        // Debug
        console.log('[TikTok debug]', {
            username,
            pageTitle,
            isLiveByTitle,
            hasLiveRoom,
            isLiveFlag,
            statusCode,
            rawViewers
        });


        // REGLA 1: Si status NO es 2, está offline
        if (statusCode !== 2) {
            console.log(`❌ [TikTok] ${username} no está en vivo (status: ${statusCode})`);
            return {
                isLive: false,
                platform: 'tiktok',
                username
            };
        }

        // REGLA 2: Si status es 2, validar con otros indicadores
        const hasMinimumIndicators =
            (isLiveByTitle || hasLiveRoom || isLiveFlag) &&
            rawViewers >= 0; // Aceptamos 0 viewers al inicio

        if (!hasMinimumIndicators) {
            console.log(`❌ [TikTok] ${username} status 2 pero sin indicadores suficientes`);
            return {
                isLive: false,
                platform: 'tiktok',
                username
            };
        }

        // ===== 3. EXTRAER DATOS DEL STREAM =====
        let title = 'En vivo';
        let viewers = rawViewers;
        let streamThumbnail = null;
        let avatar = null;

        // Título
        if (pageTitle) {
            title = pageTitle
                .replace(/is LIVE - TikTok LIVE/i, '')
                .replace(/LIVE \| TikTok/i, '')
                .replace(/\| TikTok LIVE/i, '')
                .replace(/[(\[].*?[)\]]/g, '')
                .trim();
        }

        // Avatar
        const avatarPatterns = [
            /"avatarLarger"\s*:\s*"([^"]+)"/,
            /"avatarMedium"\s*:\s*"([^"]+)"/,
            /"avatarThumb"\s*:\s*"([^"]+)"/,
            /"avatar"\s*:\s*"([^"]+)"/
        ];

        for (const pattern of avatarPatterns) {
            const mt = html.match(pattern);
            if (mt && mt[1]) {
                avatar = mt[1].replace(/\\u002F/g, '/');
                break;
            }
        }

        // Thumbnail
        const thumbnailPatterns = [
            /"cover"\s*:\s*"([^"]+)"/,
            /"coverUrl"\s*:\s*"([^"]+)"/,
            /"liveRoomCover"\s*:\s*"([^"]+)"/,
            /"roomCover"\s*:\s*"([^"]+)"/
        ];

        for (const pattern of thumbnailPatterns) {
            const mt = html.match(pattern);
            if (mt && mt[1]) {
                streamThumbnail = mt[1].replace(/\\u002F/g, '/');
                if (streamThumbnail && !streamThumbnail.includes('?')) {
                    streamThumbnail += `?t=${Date.now()}`;
                }
                break;
            }
        }

        console.log(`✅ [TikTok] ${username} está EN VIVO - ${viewers} viewers`);

        return {
            isLive: true,
            platform: 'tiktok',
            username,
            title,
            viewers,
            startedAt: null,
            thumbnail: streamThumbnail,
            avatar
        };

    } catch (error) {
        if (error.response?.status === 404 || error.code === 'ENOTFOUND') {
            return {
                isLive: false,
                platform: 'tiktok',
                username
            };
        }

        console.error(`❌ [TikTok] Error verificando stream (${username}):`, error.message);
        return {
            isLive: false,
            platform: 'tiktok',
            username,
            error: error.message
        };
    }
}


module.exports = {
    checkStreamStatus,
    getTwitchAccessToken,
    checkTwitchStream,
    getKickAccessToken,
    checkKickStream,
    checkTikTokStream
};