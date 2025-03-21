const { Schema , model } = require('mongoose');

const verifySchema = new Schema({
    guildId : String,
    channelId : String,
    roleId : String,
    messageId : String,
    channelResultId : String
}, {
    versionKey: false
})

module.exports = model('verifySystem', verifySchema)