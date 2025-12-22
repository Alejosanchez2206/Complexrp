// Models/tempVoiceConfig.js
const { Schema, model } = require('mongoose');

const tempVoiceConfigSchema = new Schema({
    // Identificadores principales
    guildId: {
        type: String,
        required: true
    },
    generatorChannelId: {
        type: String,
        required: true,
        unique: true
    },
    categoryId: {
        type: String,
        required: true
    },

    // ===== MÚLTIPLES ROLES CON PERMISOS DE DISCORD =====
    rolesPermisos: [{
        roleId: {
            type: String,
            required: true
        },
        roleName: {
            type: String,
            default: ''
        },
        // Permisos de Discord (los que se permitirán - allow)
        permisos: [{
            type: String,
            enum: [
                // Permisos generales
                'ViewChannel',
                'ManageChannels',
                'ManageRoles',
                'CreateInstantInvite',
                
                // Permisos de voz
                'Connect',
                'Speak',
                'Stream',
                'UseVAD',
                'PrioritySpeaker',
                'MuteMembers',
                'DeafenMembers',
                'MoveMembers',
                'UseSoundboard',
                'UseExternalSounds',
                
                // Permisos de texto en voz
                'SendMessages',
                'EmbedLinks',
                'AttachFiles',
                'AddReactions',
                'UseExternalEmojis',
                'ReadMessageHistory',
                'ManageMessages'
            ]
        }],
        // Si este rol puede crear canales (entrar al generador)
        puedeCrear: {
            type: Boolean,
            default: false
        },
        addedAt: {
            type: Date,
            default: Date.now
        },
        addedBy: {
            type: String,
            default: null
        }
    }],

    // Configuración del canal temporal
    settings: {
        defaultName: {
            type: String,
            default: '🎧 Sala de {user}'
        },
        userLimit: {
            type: Number,
            default: 0,
            min: 0,
            max: 99
        },
        bitrate: {
            type: Number,
            default: 64000,
            min: 8000,
            max: 384000
        },
        privateByDefault: {
            type: Boolean,
            default: true
        }
    },

    // Estadísticas
    stats: {
        totalCreated: {
            type: Number,
            default: 0
        },
        lastUsed: {
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

// Índices
tempVoiceConfigSchema.index({ guildId: 1 });
tempVoiceConfigSchema.index({ guildId: 1, generatorChannelId: 1 });

// Middleware
tempVoiceConfigSchema.pre('save', function(next) {
    this.updatedAt = new Date();
    next();
});

module.exports = model('TempVoiceConfig', tempVoiceConfigSchema);