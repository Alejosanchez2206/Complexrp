const { Schema, model } = require('mongoose');

const whitelistInvitacionSchema = new Schema({
    guildId: String,
    userId : String,
    codeWl : String,
    codeUse : {
        type: Number,
        default: 2
    },
    CodeRemdeem : {
        type: Number,
        default: 0
    },
    codeDate : {
        type: Date,
        default: null
    },
    history : {
        type: Array,
        default: []
    }
}, {
    versionKey: false
});

module.exports = model('whitelistInvitaciones', whitelistInvitacionSchema);