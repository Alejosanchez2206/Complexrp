const { Schema, model } = require('mongoose');

const permisosSchema = new Schema({
    guild: { 
        type: String, 
        required: true 
    },
    rol: { 
        type: String, 
        required: true 
    },
    permisos: { 
        type: [String], 
        default: [] 
    },
    // Campo legacy para compatibilidad
    permiso: { 
        type: String 
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

// Índice compuesto para búsquedas rápidas
permisosSchema.index({ guild: 1, rol: 1 }, { unique: true });

module.exports = model('Permisos', permisosSchema);