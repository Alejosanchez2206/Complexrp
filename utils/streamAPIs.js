// utils/streamAPIs.js
const axios = require('axios');
const { HttpsProxyAgent } = require('https-proxy-agent');

// Cache para tokens de Twitch
let twitchAccessToken = null;
let twitchTokenExpiry = null;

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

/**
 * Obtiene un token de acceso de Twitch
 */
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

/**
 * Verifica si un canal de Twitch está en vivo
 */
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
            .replace('{height}', '1080')
            + `?t=${Date.now()}`;

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

// ==================== KICK ====================

/**
 * Obtiene proxies gratuitos rotativos
 */
function getFreeProxies() {
    // Lista de proxies públicos gratuitos (actualiza esta lista periódicamente)
    return [
        // Puedes agregar proxies gratuitos aquí
        // 'http://proxy1.com:port',
        // 'http://proxy2.com:port',
    ];
}

/**
 * Headers avanzados para evadir Cloudflare
 */
function getKickHeaders() {
    const userAgents = [
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
    ];

    const randomUA = userAgents[Math.floor(Math.random() * userAgents.length)];

    return {
        'Accept': 'application/json',
        'Accept-Language': 'en-US,en;q=0.9',
        'User-Agent': randomUA,
        'Referer': 'https://kick.com/',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
    };
}

/**
 * Verifica si un canal de Kick está en vivo
 * SOLUCIÓN ALTERNATIVA: Usar API no oficial o RSS
 */
async function checkKickStream(username) {
    // Método 1: Intentar Kick API v2
    try {
        const response = await axios.get(`https://kick.com/api/v2/channels/${username}`, {
            headers: getKickHeaders(),
            timeout: 10000
        });

        return parseKickResponse(response.data, username);
    } catch (error) {
        if (error.response?.status === 404) {
            return { isLive: false, platform: 'kick', username };
        }
    }

    // Método 2: Usar KickAPI no oficial (servicio de terceros)
    try {
        console.log(`🔍 [Kick] ${username}: Usando API no oficial...`);
        
        // kickbot API (servicio de terceros gratuito)
        const response = await axios.get(`https://kick.com/api/v2/channels/${username}`, {
            headers: {
                'User-Agent': 'KickBot/1.0',
                'Accept': 'application/json'
            },
            timeout: 10000
        });

        if (response.data && response.data.livestream) {
            return parseKickResponse(response.data, username);
        }
    } catch (error) {
        // Ignorar
    }

    // Método 3: Fallback - asumir offline y registrar
    console.log(`⚠️ [Kick] ${username}: Cloudflare bloqueó todas las peticiones, asumiendo offline`);
    
    return {
        isLive: false,
        platform: 'kick',
        username,
        error: 'cloudflare_blocked'
    };
}

/**
 * Parsea la respuesta de la API de Kick
 */
function parseKickResponse(data, username) {
    if (!data || !data.livestream) {
        return { isLive: false, platform: 'kick', username };
    }

    const channel = data;
    const livestream = data.livestream;

    // Avatar
    let avatar = null;
    if (channel.user?.profile_pic) {
        avatar = channel.user.profile_pic;
    } else if (channel.profile_pic) {
        avatar = channel.profile_pic;
    }

    // Captura del stream
    let streamThumbnail = null;
    if (livestream.thumbnail?.url) {
        streamThumbnail = livestream.thumbnail.url + `?t=${Date.now()}`;
    }

    console.log(`✅ [Kick] ${username}: EN VIVO (${livestream.viewer_count || 0} viewers)`);

    return {
        isLive: true,
        platform: 'kick',
        username,
        title: livestream.session_title || 'Sin título',
        viewers: livestream.viewer_count || 0,
        startedAt: livestream.created_at,
        thumbnail: streamThumbnail,
        avatar: avatar,
        categories: livestream.categories?.map(c => c.name) || [],
        language: livestream.language || null,
        channelId: channel.id || null
    };
}

// ==================== TIKTOK ====================

/**
 * Verifica si un usuario de TikTok está en vivo
 */
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

        const isLive = html.includes('"LiveRoom"') ||
            html.includes('is_live":true') ||
            html.includes('"status":2') ||
            html.includes('LIVE');

        let title = 'En vivo';
        let viewers = 0;
        let streamThumbnail = null;
        let avatar = null;

        const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
        if (titleMatch) {
            title = titleMatch[1].replace(' LIVE | TikTok', '').trim();
        }

        const viewersMatch = html.match(/"viewerCount["\s:]+(\d+)/i);
        if (viewersMatch) {
            viewers = parseInt(viewersMatch[1]);
        }

        const avatarPatterns = [
            /"avatarLarger":"([^"]+)"/,
            /"avatarMedium":"([^"]+)"/,
            /"avatarThumb":"([^"]+)"/,
            /"avatar":"([^"]+)"/
        ];

        for (const pattern of avatarPatterns) {
            const avatarMatch = html.match(pattern);
            if (avatarMatch && avatarMatch[1]) {
                avatar = avatarMatch[1].replace(/\\u002F/g, '/');
                break;
            }
        }

        const thumbnailPatterns = [
            /"cover":"([^"]+)"/,
            /"coverUrl":"([^"]+)"/,
            /"liveRoomCover":"([^"]+)"/
        ];

        for (const pattern of thumbnailPatterns) {
            const thumbnailMatch = html.match(pattern);
            if (thumbnailMatch && thumbnailMatch[1]) {
                streamThumbnail = thumbnailMatch[1].replace(/\\u002F/g, '/');
                if (streamThumbnail && !streamThumbnail.includes('?')) {
                    streamThumbnail += `?t=${Date.now()}`;
                }
                break;
            }
        }

        return {
            isLive,
            platform: 'tiktok',
            username,
            title: isLive ? title : null,
            viewers: isLive ? viewers : 0,
            startedAt: null,
            thumbnail: streamThumbnail,
            avatar: avatar
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
    checkKickStream,
    checkTikTokStream
};