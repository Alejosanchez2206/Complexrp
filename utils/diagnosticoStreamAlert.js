const mongoose = require('mongoose');
require('dotenv').config();

const streamAlertSchema = require('../Models/streamAlertConfig');

async function diagnosticar(guildId) {
    try {
        // Conectar a MongoDB
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Conectado a MongoDB\n');

        // Buscar configuración
        const config = await streamAlertSchema.findOne({ guildId });

        if (!config) {
            console.log('❌ No se encontró configuración para este servidor');
            process.exit(1);
        }

        console.log('📋 CONFIGURACIÓN ENCONTRADA\n');
        console.log('Guild ID:', config.guildId);
        console.log('Canal de alertas:', config.alertChannelId);
        console.log('Creado por:', config.createdBy);
        console.log('Creado:', config.createdAt);
        console.log('\n');

        // API Keys
        console.log('🔑 API KEYS');
        console.log('───────────────────────────────────');
        console.log('Objeto apiKeys existe:', !!config.apiKeys);
        console.log('Twitch Client ID:', config.apiKeys?.twitchClientId || '❌ No configurado');
        console.log('Twitch Client Secret:', config.apiKeys?.twitchClientSecret ? '✅ Configurado (oculto)' : '❌ No configurado');
        console.log('\n');

        // Streamers
        console.log('🎮 STREAMERS');
        console.log('───────────────────────────────────');
        console.log('Total:', config.streamers.length);
        config.streamers.forEach((s, i) => {
            console.log(`\n${i + 1}. ${s.displayName} (@${s.username})`);
            console.log(`   Plataforma: ${s.platform}`);
            console.log(`   ID: ${s.streamerId}`);
            console.log(`   Activo: ${s.enabled ? 'Sí' : 'No'}`);
            console.log(`   En vivo: ${s.isLive ? 'Sí' : 'No'}`);
        });
        console.log('\n');

        // Keywords
        console.log('🔑 KEYWORDS');
        console.log('───────────────────────────────────');
        console.log('Total:', config.globalKeywords.length);
        config.globalKeywords.forEach((k, i) => {
            console.log(`${i + 1}. "${k.keyword}"`);
        });
        console.log('\n');

        // Settings
        console.log('⚙️ CONFIGURACIÓN');
        console.log('───────────────────────────────────');
        console.log('Intervalo:', config.settings.checkInterval, 'minutos');
        console.log('Auto-eliminar:', config.settings.autoDeleteMessages ? 'Sí' : 'No');
        console.log('Incluir thumbnail:', config.settings.includeThumbnail ? 'Sí' : 'No');
        console.log('Requerir keywords:', config.settings.requireKeywords ? 'Sí' : 'No');
        console.log('Mensaje por defecto:', config.settings.defaultMessage);
        console.log('\n');

        // Stats
        console.log('📊 ESTADÍSTICAS');
        console.log('───────────────────────────────────');
        console.log('Notificaciones enviadas:', config.stats.totalNotificationsSent);
        console.log('Última verificación:', config.stats.lastCheck || 'Nunca');
        console.log('\n');

        // Verificar estructura completa del documento
        console.log('📄 ESTRUCTURA COMPLETA DEL DOCUMENTO');
        console.log('───────────────────────────────────');
        console.log(JSON.stringify(config.toObject(), null, 2));

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await mongoose.disconnect();
        console.log('\n✅ Desconectado de MongoDB');
    }
}

// Ejecutar
const guildId = process.argv[2];

if (!guildId) {
    console.log('❌ Uso: node utils/diagnosticoStreamAlert.js <guildId>');
    process.exit(1);
}

diagnosticar(guildId);