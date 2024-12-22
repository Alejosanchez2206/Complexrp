const { Schema , model } = require('mongoose');

const blackUser = new Schema({
    userId: {
        type: String,
        required: true,
        unique: true
    },
    reason: {
        type: String,
        required: true
    }
});

module.exports = model('blackUsers', blackUser);