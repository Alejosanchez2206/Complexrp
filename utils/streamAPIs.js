// utils/streamAPIs.js
const axios = require('axios');

// Cache para tokens de Twitch
let twitchAccessToken = null;
let twitchTokenExpiry = null;

const config = require('../config.json');

// Puppeteer (opcional, se carga solo si es necesario)
let puppeteer = null;

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
 * Headers avanzados para evadir Cloudflare
 */
function getKickHeaders() {
    const userAgents = [
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:132.0) Gecko/20100101 Firefox/132.0',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15'
    ];

    const randomUA = userAgents[Math.floor(Math.random() * userAgents.length)];

    return {
        'Accept': 'application/json',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'User-Agent': randomUA,
        'Referer': 'https://kick.com/',
        'Origin': 'https://kick.com',
        'Sec-Ch-Ua': '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
        'Sec-Ch-Ua-Mobile': '?0',
        'Sec-Ch-Ua-Platform': '"Windows"',
        'Sec-Fetch-Dest': 'empty',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'same-origin',
        'Connection': 'keep-alive'
    };
}

/**
 * Verifica si un canal de Kick está en vivo - Método principal
 */
async function checkKickStream(username) {
    // Método 1: API v2
    try {
        const response = await axios.get(`https://kick.com/api/v2/channels/${username}`, {
            headers: getKickHeaders(),
            timeout: 8000,
            maxRedirects: 5
        });

        return parseKickResponse(response.data, username);

    } catch (error) {
        if (error.response?.status === 404) {
            return { isLive: false, platform: 'kick', username };
        }

        console.log(`⚠️ [Kick] ${username}: API v2 falló (${error.response?.status || error.code}), probando v1...`);
    }

    // Método 2: API v1
    try {
        const response = await axios.get(`https://kick.com/api/v1/channels/${username}`, {
            headers: getKickHeaders(),
            timeout: 8000,
            maxRedirects: 5
        });

        return parseKickResponse(response.data, username);

    } catch (error) {
        console.log(`⚠️ [Kick] ${username}: API v1 falló, usando Puppeteer...`);
    }

    // Método 3: Puppeteer (definitivo contra Cloudflare)
    return await checkKickStreamWithPuppeteer(username);
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
    } else if (channel.user?.profilepic) {
        avatar = channel.user.profilepic;
    }

    // Captura del stream
    let streamThumbnail = null;
    if (livestream.thumbnail?.url) {
        streamThumbnail = livestream.thumbnail.url + `?t=${Date.now()}`;
    }

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

/**
 * Verifica Kick usando Puppeteer (método definitivo contra Cloudflare)
 */
async function checkKickStreamWithPuppeteer(username) {
    // Cargar Puppeteer solo si es necesario
    if (!puppeteer) {
        try {
            puppeteer = require('puppeteer');
        } catch (error) {
            console.error('❌ [Kick] Puppeteer no está instalado. Ejecuta: npm install puppeteer');
            return {
                isLive: false,
                platform: 'kick',
                username,
                error: 'puppeteer_not_installed'
            };
        }
    }

    let browser;
    try {
        console.log(`🎭 [Kick/Puppeteer] Verificando ${username}...`);

        browser = await puppeteer.launch({
            headless: 'new',
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--disable-gpu',
                '--disable-blink-features=AutomationControlled'
            ]
        });

        const page = await browser.newPage();

        // Configurar viewport y user agent
        await page.setViewport({ width: 1920, height: 1080 });
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36');

        // NO bloquear recursos - necesitamos cargar todo para obtener los datos
        // Comentamos el bloqueo para asegurar que cargue completamente
        
        // Navegar a la API directamente con Puppeteer (evita Cloudflare)
        const apiUrl = `https://kick.com/api/v2/channels/${username}`;
        
        try {
            // Intentar primero con la API usando el navegador de Puppeteer
            await page.goto(apiUrl, {
                waitUntil: 'networkidle0',
                timeout: 30000
            });

            // Esperar un poco para que cargue
            await new Promise(resolve => setTimeout(resolve, 2000));

            // Extraer el JSON de la página
            const jsonContent = await page.evaluate(() => {
                return document.querySelector('pre')?.textContent || document.body.textContent;
            });

            if (jsonContent) {
                try {
                    const data = JSON.parse(jsonContent);
                    await browser.close();
                    return parseKickResponse(data, username);
                } catch (e) {
                    console.log(`⚠️ [Kick/Puppeteer] No se pudo parsear JSON de API, probando web scraping...`);
                }
            }
        } catch (apiError) {
            console.log(`⚠️ [Kick/Puppeteer] API bloqueada, usando web scraping...`);
        }

        // Si la API falló, hacer web scraping de la página principal
        const response = await page.goto(`https://kick.com/${username}`, {
            waitUntil: 'networkidle2',
            timeout: 30000
        });

        // Verificar si el canal existe
        if (response.status() === 404) {
            await browser.close();
            return { isLive: false, platform: 'kick', username };
        }

        // Esperar más tiempo para que cargue completamente
        await new Promise(resolve => setTimeout(resolve, 5000));

        // Extraer datos de la página
        const streamData = await page.evaluate(() => {
            let isLive = false;
            let title = 'En vivo';
            let viewers = 0;
            let thumbnail = null;
            let avatar = null;
            let categories = [];

            // Método 1: Buscar el badge de LIVE
            const liveBadge = document.querySelector('.text-white.bg-red') ||
                             document.querySelector('[class*="live"]') ||
                             document.querySelector('[class*="bg-red"]');
            
            if (liveBadge && liveBadge.textContent.includes('LIVE')) {
                isLive = true;
                console.log('✅ Encontrado badge LIVE');
            }

            // Método 2: Buscar en todos los scripts
            const scripts = Array.from(document.querySelectorAll('script'));
            
            for (const script of scripts) {
                const content = script.textContent || script.innerText;

                // Buscar livestream data
                if (content.includes('livestream') && content.includes('session_title')) {
                    isLive = true;
                    
                    // Extraer título
                    const titleMatch = content.match(/"session_title"\s*:\s*"([^"]+)"/);
                    if (titleMatch) {
                        title = titleMatch[1];
                    }

                    // Extraer viewers
                    const viewersMatch = content.match(/"viewer_count"\s*:\s*(\d+)/);
                    if (viewersMatch) {
                        viewers = parseInt(viewersMatch[1]);
                    }

                    // Extraer thumbnail
                    const thumbMatch = content.match(/"thumbnail"\s*:\s*{\s*"url"\s*:\s*"([^"]+)"/);
                    if (thumbMatch) {
                        thumbnail = thumbMatch[1];
                    }

                    // Extraer avatar
                    const avatarMatch = content.match(/"profile_pic"\s*:\s*"([^"]+)"/);
                    if (avatarMatch) {
                        avatar = avatarMatch[1].replace(/\\\//g, '/');
                    }

                    // Extraer categorías
                    const catMatch = content.match(/"categories"\s*:\s*\[([^\]]+)\]/);
                    if (catMatch) {
                        const catNames = catMatch[1].match(/"name"\s*:\s*"([^"]+)"/g);
                        if (catNames) {
                            categories = catNames.map(m => m.match(/"([^"]+)"/)[1]);
                        }
                    }

                    console.log('✅ Datos extraídos de script JSON');
                    break;
                }
            }

            // Método 3: Buscar en window.__NUXT__ (datos de Nuxt.js)
            if (typeof window.__NUXT__ !== 'undefined') {
                try {
                    const nuxtData = window.__NUXT__;
                    // Intentar encontrar datos del livestream en el objeto Nuxt
                    const dataStr = JSON.stringify(nuxtData);
                    
                    if (dataStr.includes('livestream')) {
                        isLive = true;
                        
                        const viewersNuxt = dataStr.match(/"viewer_count"\s*:\s*(\d+)/);
                        if (viewersNuxt) {
                            viewers = parseInt(viewersNuxt[1]);
                        }
                        
                        console.log('✅ Datos encontrados en __NUXT__');
                    }
                } catch (e) {
                    console.log('⚠️ Error parseando __NUXT__');
                }
            }

            // Método 4: Buscar meta tags
            const metaTitle = document.querySelector('meta[property="og:title"]');
            if (metaTitle && !title.includes('Grand Theft Auto')) {
                const metaTitleContent = metaTitle.getAttribute('content');
                if (metaTitleContent) {
                    title = metaTitleContent;
                }
            }

            const metaThumb = document.querySelector('meta[property="og:image"]');
            if (metaThumb && !thumbnail) {
                thumbnail = metaThumb.getAttribute('content');
            }

            // Método 5: Buscar texto de espectadores en la página
            const viewerElements = document.querySelectorAll('*');
            for (const el of viewerElements) {
                const text = el.textContent;
                if (text && text.includes('Espectadores') && viewers === 0) {
                    const match = text.match(/(\d+)\s*Espectadores/);
                    if (match) {
                        viewers = parseInt(match[1]);
                        isLive = true;
                        console.log(`✅ Encontrados ${viewers} espectadores`);
                    }
                }
            }

            console.log(`Resultado final: isLive=${isLive}, viewers=${viewers}, title=${title}`);

            return { isLive, title, viewers, thumbnail, avatar, categories };
        });

        await browser.close();

        console.log(`✅ [Kick/Puppeteer] ${username}: ${streamData.isLive ? `EN VIVO (${streamData.viewers} viewers)` : 'Offline'}`);

        if (!streamData.isLive) {
            return { isLive: false, platform: 'kick', username };
        }

        return {
            isLive: true,
            platform: 'kick',
            username,
            title: streamData.title,
            viewers: streamData.viewers,
            startedAt: null,
            thumbnail: streamData.thumbnail ? streamData.thumbnail + `?t=${Date.now()}` : null,
            avatar: streamData.avatar,
            categories: streamData.categories,
            language: null,
            method: 'puppeteer'
        };

    } catch (error) {
        if (browser) {
            try {
                await browser.close();
            } catch (e) {
                // Ignorar errores al cerrar
            }
        }
        
        console.error(`❌ [Kick/Puppeteer] Error para ${username}:`, error.message);
        
        return {
            isLive: false,
            platform: 'kick',
            username,
            error: 'puppeteer_error'
        };
    }
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
