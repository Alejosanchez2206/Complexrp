// Models/customCommand.js
const { Schema, model } = require('mongoose');

const customCommandSchema = new Schema({
    guildId: {
        type: String,
        required: true,
        index: true
    },
    commandName: {
        type: String,
        required: true,
        lowercase: true,
        trim: true
    },
    tipo: {
        type: String,
        enum: ['texto', 'embed'],
        default: 'texto'
    },
    // Para respuestas de texto simple
    response: {
        type: String,
        default: null
    },
    // Para respuestas tipo embed
    embedData: {
        title: String,
        description: String,
        color: {
            type: String,
            default: '#0099ff'
        },
        footer: String,
        thumbnail: String,
        image: String,
        fields: [{
            name: String,
            value: String,
            inline: {
                type: Boolean,
                default: false
            }
        }]
    },
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

// Índice compuesto único
customCommandSchema.index({ guildId: 1, commandName: 1 }, { unique: true });

module.exports = model('CustomCommand', customCommandSchema);