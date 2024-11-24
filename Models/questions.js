const { Schema , model } = require('mongoose');

const questionsSchema = new Schema({
    guildId : String,
    question : String
}, {
    versionKey: false
})

module.exports = model('questions', questionsSchema)