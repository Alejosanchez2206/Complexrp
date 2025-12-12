const { Schema, model } = require('mongoose');

const soporteVozSchema = new Schema({
    guild: {
        type: String,
        required: true,
        index: true
    },
    numeroSoporte: {
        type: Number,
        required: true
    },
    usuarioId: {
        type: String,
        required: true
    },
    usuarioTag: {
        type: String,
        required: true
    },
    staffId: {
        type: String,
        required: true
    },
    staffTag: {
        type: String,
        required: true
    },
    caso: {
        type: String,
        required: true,
        maxlength: 500
    },
    solucionado: {
        type: String,
        enum: ['si', 'no', 'parcial'],
        required: true
    },
    sancion: {
        type: String,
        enum: ['no', 'advertencia', 'kick', 'ban_temporal', 'ban_permanente'],
        default: 'no'
    },
    notas: {
        type: String,
        maxlength: 1000,
        default: 'Ninguna'
    },
    // Nuevos campos para tracking
    canalId: {
        type: String,
        default: null
    },
    canalNombre: {
        type: String,
        default: null
    },
    fecha: {
        type: Date,
        default: Date.now
    },
    timestamp: {
        type: Number,
        default: Date.now
    },
    // Campos opcionales
    cerrado: {
        type: Boolean,
        default: false
    },
    cerradoPor: {
        type: String,
        default: null
    },
    fechaCierre: {
        type: Date,
        default: null
    }
});

// Índices compuestos para búsquedas rápidas
soporteVozSchema.index({ guild: 1, numeroSoporte: -1 });
soporteVozSchema.index({ guild: 1, usuarioId: 1 });
soporteVozSchema.index({ guild: 1, staffId: 1 });
soporteVozSchema.index({ guild: 1, fecha: -1 });
soporteVozSchema.index({ guild: 1, cerrado: 1 });

module.exports = model('SoporteVoz', soporteVozSchema);