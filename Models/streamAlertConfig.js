// Models/streamAlertConfig.js
const { Schema, model } = require('mongoose');

const streamAlertConfigSchema = new Schema({
    // Identificadores principales
    guildId: {
        type: String,
        required: true,
        index: true
    },
    
    // Canal donde se enviarán las alertas
    alertChannelId: {
        type: String,
        required: true
    },

    // ===== STREAMERS CONFIGURADOS =====
    streamers: [{
        // ID único del streamer en la configuración
        streamerId: {
            type: String,
            required: true
        },

        // Nombre del streamer
        displayName: {
            type: String,
            required: true
        },

        // Plataforma: twitch, kick, tiktok
        platform: {
            type: String,
            required: true,
            enum: ['twitch', 'kick', 'tiktok']
        },

        // Username en la plataforma
        username: {
            type: String,
            required: true
        },

        // Rol que será mencionado cuando el stream inicie
        roleId: {
            type: String,
            required: false,
            default: null
        },

        // Mensaje personalizado (opcional)
        customMessage: {
            type: String,
            default: null
        },

        // ID del último mensaje de alerta enviado
        lastMessageId: {
            type: String,
            default: null
        },

        // Estado actual del stream
        isLive: {
            type: Boolean,
            default: false
        },

        // Última vez que estuvo en vivo
        lastLiveCheck: {
            type: Date,
            default: null
        },

        // Título del stream actual
        currentStreamTitle: {
            type: String,
            default: null
        },

        // Viewers actuales
        currentViewers: {
            type: Number,
            default: 0
        },

        // Hora de inicio del stream actual
        streamStartedAt: {
            type: Date,
            default: null
        },

        // Estadísticas
        stats: {
            totalStreams: {
                type: Number,
                default: 0
            },
            lastStream: {
                type: Date,
                default: null
            }
        },

        // Metadatos
        addedBy: {
            type: String,
            required: true
        },
        addedAt: {
            type: Date,
            default: Date.now
        },
        enabled: {
            type: Boolean,
            default: true
        }
    }],

    // ===== PALABRAS CLAVE GLOBALES =====
    globalKeywords: [{
        keyword: {
            type: String,
            required: true
        },
        addedBy: {
            type: String,
            required: true
        },
        addedAt: {
            type: Date,
            default: Date.now
        }
    }],

    // ===== CONFIGURACIÓN GENERAL =====
    settings: {
        // Intervalo de verificación en minutos (por defecto 10)
        checkInterval: {
            type: Number,
            default: 10,
            min: 1,
            max: 60
        },

        // Eliminar mensajes automáticamente cuando el stream termine
        autoDeleteMessages: {
            type: Boolean,
            default: true
        },

        // Incluir thumbnail del stream
        includeThumbnail: {
            type: Boolean,
            default: true
        },

        // Mensaje por defecto
        defaultMessage: {
            type: String,
            default: '🔴 ¡{streamer} está en vivo!'
        },

        // Enviar notificaciones solo si el título contiene keywords
        requireKeywords: {
            type: Boolean,
            default: false
        }
    },

    // ===== API KEYS =====
    apiKeys: {
        twitchClientId: {
            type: String,
            default: null
        },
        twitchClientSecret: {
            type: String,
            default: null
        }
    },

    // ===== ESTADÍSTICAS =====
    stats: {
        totalNotificationsSent: {
            type: Number,
            default: 0
        },
        lastCheck: {
            type: Date,
            default: null
        }
    },

    // Metadatos
    createdBy: {
        type: String,
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// Índices compuestos
streamAlertConfigSchema.index({ guildId: 1, alertChannelId: 1 });
streamAlertConfigSchema.index({ 'streamers.username': 1, 'streamers.platform': 1 });

// Middleware para actualizar updatedAt
streamAlertConfigSchema.pre('save', function(next) {
    this.updatedAt = new Date();
    next();
});

module.exports = model('StreamAlertConfig', streamAlertConfigSchema);