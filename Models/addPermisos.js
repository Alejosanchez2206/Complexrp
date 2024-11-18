const { model , Schema } = require('mongoose')

let permisosSchema = new Schema({
    guild: String,
    rol: String,
    permiso: String
}, {
    versionKey: false
})

module.exports = model('permisos', permisosSchema)