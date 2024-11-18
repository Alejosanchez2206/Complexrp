const { model , Schema } = require('mongoose')

const welcomeSchema = new Schema({
    guilId : String,
    channelId : String,
    WelcomeMessage : String,
    WelcomeImage : String,
    systemOptions : Boolean

}, {
    versionKey: false
})

module.exports = model('welcomesSystem', welcomeSchema)