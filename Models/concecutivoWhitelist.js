const { Schema , model } = require('mongoose');

const whitelistSchema = new Schema({
    guildId : String,
    numberConsecutivo : Number
}, {
    versionKey: false
})

module.exports = model('concecutivoWhitelist', whitelistSchema)