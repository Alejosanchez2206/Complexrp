const { Schema , model } = require('mongoose');

const customCommandSchema = new Schema({
    guildId: String,
    commandName: String,
    response: String
}, {
    versionKey: false
})

module.exports = model('customCommand', customCommandSchema)