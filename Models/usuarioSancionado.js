// Models/usuarioSancionado.js
const { Schema, model } = require('mongoose');

const usuarioSancionadoSchema = new Schema({
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
    
    // Estadísticas
    totalWarnings: {
        type: Number,
        default: 0
    },
    totalKicks: {
        type: Number,
        default: 0
    },
    totalBans: {
        type: Number,
        default: 0
    },
    
    // Warnings por grupo
    warningsGrupo1: {
        type: Number,
        default: 0
    },
    warningsGrupo2: {
        type: Number,
        default: 0
    },
    warningsGrupo3: {
        type: Number,
        default: 0
    },
    
    // Referencias a sanciones
    sanciones: [{
        type: Schema.Types.ObjectId,
        ref: 'Sanciones'
    }],
    
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// Índice compuesto
usuarioSancionadoSchema.index({ guildId: 1, userId: 1 }, { unique: true });

module.exports = model('UsuarioSancionado', usuarioSancionadoSchema);