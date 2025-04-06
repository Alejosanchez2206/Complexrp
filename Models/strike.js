const { Schema , model } = require('mongoose');

const strikeSchema = new Schema({
    guildId : String,
    userId : String,
    roleId : String,
    date : Date,
    staff : String,
}, {
    versionKey: false,
    timestamps: true
})

module.exports = model('strikes', strikeSchema)