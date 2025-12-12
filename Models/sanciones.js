// Models/sanciones.js
const { Schema, model } = require('mongoose');

const sancionSchema = new Schema({
    guildId: {
        type: String,
        required: true,
        index: true
    },
    userId: {
        type: String,
        required: true,
        index: true
    },
    userTag: {
        type: String,
        required: true
    },
    tipo: {
        type: String,
        enum: ['warning', 'kick', 'ban_temporal', 'ban_permanente', 'organizacion', 'faccion_legal'],
        required: true
    },
    
    // Para sanciones grupales
    organizacion: String,
    
    // Información de la sanción
    motivos: {
        type: [String],
        required: true
    },
    descripcion: {
        type: String,
        required: true
    },
    evidencia: {
        type: String,
        default: 'N/A'
    },
    
    // Para warnings
    warningGrupo: {
        type: Number,
        min: 1,
        max: 3,
        default: null
    },
    warningNumero: {
        type: Number,
        min: 1,
        max: 3,
        default: null
    },
    
    // Para bans temporales
    duracionDias: {
        type: Number,
        default: null
    },
    fechaInicio: {
        type: Date,
        default: Date.now
    },
    fechaFin: {
        type: Date,
        default: null
    },
    
    // Staff que aplicó la sanción
    staffId: {
        type: String,
        required: true
    },
    staffTag: {
        type: String,
        required: true
    },
    
    // Metadata
    messageId: String,
    channelId: String,
    activa: {
        type: Boolean,
        default: true
    },
    apelada: {
        type: Boolean,
        default: false
    },
    motivoRevocacion: String,
    fechaRevocacion: Date,
    
    createdAt: {
        type: Date,
        default: Date.now,
        index: true
    }
});

// Índices compuestos para búsquedas eficientes
sancionSchema.index({ guildId: 1, userId: 1, tipo: 1 });
sancionSchema.index({ guildId: 1, userId: 1, activa: 1 });
sancionSchema.index({ guildId: 1, organizacion: 1 });

module.exports = model('Sanciones', sancionSchema);