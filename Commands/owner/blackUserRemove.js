const {
    SlashCommandBuilder,
    Client,
    PermissionFlagsBits
} = require('discord.js');

const config = require('../../config.json');
const blackUser = require('../../Models/blackUser');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('blacklist-remove')
        .setDescription('Elimina un usuario de la blacklist')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addUserOption(option => option
            .setName('user')
            .setDescription('El usuario que se eliminara de la blacklist')
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
                const validarBlack = await blackUser.findOne({ userId: user.id });
                if (!validarBlack) {
                    return interation.reply({ content: 'El usuario no esta en la blacklist', ephemeral: true });
                }

                await blackUser.findOneAndDelete({ userId: user.id });

                return interation.reply({ content: `Se elimino el usuario ${user.username} de la blacklist`, ephemeral: true });
            } else {
                return interation.reply({ content: 'No tienes permisos para usar este comando', ephemeral: true });
            }
        } catch (error) {
            console.log(error)
            interation.reply({ content: `Ocurrio un error al ejecutar el comando ${interation.commandName}`, ephemeral: true });
        }
    }
}