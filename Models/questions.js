const { Schema , model } = require('mongoose');

const questionsSchema = new Schema({
    guildId : String,
    question : String,
    options : Array,
    type : String
}, {
    versionKey: false
})

module.exports = model('questions', questionsSchema)