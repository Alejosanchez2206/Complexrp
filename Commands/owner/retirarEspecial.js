const {
    SlashCommandBuilder,
    Client,
    PermissionFlagsBits,
    ChatInputCommandInteraction
} = require('discord.js');
const config = require('../../config.json');

const permisosEspecialSchema = require('../../Models/permisosEspecial');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('retirar-especial')
        .setDescription('Retira un permiso especial a un usuario')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addUserOption(option => option
            .setName('user')
            .setDescription('El usuario al que se le retirara el permiso especial')
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
                const validarPermiso = await permisosEspecialSchema.findOne({ guildServidor: interation.guild.id, guildUsuario: user.id });

                if (validarPermiso) {
                    await permisosEspecialSchema.findOneAndDelete({ guildServidor: interation.guild.id, guildUsuario: user.id });
                    return interation.reply({ content: `Se retiro el permiso especial para el usuario ${user.username}`, ephemeral: true });
                } else {
                    return interation.reply({ content: 'El usuario no tiene este permiso especial', ephemeral: true });
                }

            } else {
                return interation.reply({ content: 'No tienes permisos para usar este comando', ephemeral: true });
            }

        } catch (error) {
           console.log(error)
           interation.reply({ content: `Ocurrio un error al ejecutar el comando ${interation.commandName}`, ephemeral: true });
        }
    }

}