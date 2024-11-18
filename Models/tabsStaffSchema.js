const { Schema , model } = require('mongoose');

const tabsStaffSchema = new Schema({
    guildId : String,
    roleId : String,
    tabStaff : String
}, {
    versionKey: false
})

module.exports = model('tabsStaff', tabsStaffSchema)