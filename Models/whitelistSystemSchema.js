const { Schema , model } = require('mongoose');

const whitelistSchema = new Schema({
    guildId : String,
    roleId : String,
    channelId : String,
    channelResult : String,
    channelSend : String
}, {
    versionKey: false
})

module.exports = model('whitelistSystems', whitelistSchema)
