const {
    SlashCommandBuilder,
    Client,
    PermissionFlagsBits
} = require('discord.js');
const config = require('../../config.json');
const EspecialpermisosSchema = require('../../Models/permisosEspecial');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('agregar-especial')
        .setDescription('Agrega un permiso especial a un usuario')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addUserOption(option => option
            .setName('user')
            .setDescription('El usuario al que se le agregara el permiso especial')
            .setRequired(true)
        ),

    /**
 * @param {ChatInputCommandInteraction} interation
 * @param {Client} client 
 */

    async execute(interation, client) {
        try {
            const { options } = interation;
            const user = options.getUser('user');

            if (config.Owners === interation.user.id) {
                const validarPermiso = await EspecialpermisosSchema.findOne({ guildServidor: interation.guild.id, guildUsuario: user.id });
                if (validarPermiso) {
                    return interation.reply({ content: 'El usuario ya tiene este permiso', ephemeral: true });
                }

                const permisos = new EspecialpermisosSchema({
                    guildServidor: interation.guild.id,
                    guildUsuario: user.id,
                    userName: user.username,
                    guildAsignado: interation.user.id,
                    userAsignado: interation.user.username
                });

                await permisos.save();

                return interation.reply({ content: `Se agrego el permiso especial para el usuario ${user.username}`, ephemeral: true });
            } else {
                return interation.reply({ content: 'No tienes permisos para usar este comando', ephemeral: true });
            }
        } catch (error) {
            console.log(error)
            interation.reply({ content: `Ocurrio un error al ejecutar el comando ${interation.commandName}`, ephemeral: true });
        }
    }

}