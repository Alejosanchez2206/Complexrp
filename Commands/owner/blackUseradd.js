const {
    SlashCommandBuilder,
    Client,
    PermissionFlagsBits
} = require('discord.js');

const config = require('../../config.json');
const blackUser = require('../../Models/blackUser');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('blacklist-add')
        .setDescription('Agrega un usuario a la blacklist')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addUserOption(option => option
            .setName('user')
            .setDescription('El usuario que se agregara a la blacklist')
            .setRequired(true)
        )
        .addStringOption(option => option
            .setName('reason')
            .setDescription('La razon por la que se agrega a la blacklist')
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
            const reason = options.getString('reason');

            if (config.Owners === interation.user.id) {
                const validarBlack = await blackUser.findOne({ userId: user.id });
                if (validarBlack) {
                    return interation.reply({ content: 'El usuario ya esta en la blacklist', ephemeral: true });
                }

                const black = new blackUser({
                    userId: user.id,
                    reason: reason
                });

                await black.save();

                return interation.reply({ content: `Se agrego el usuario ${user.username} a la blacklist`, ephemeral: true });
            } else {
                return interation.reply({ content: 'No tienes permisos para usar este comando', ephemeral: true });
            }
        } catch (error) {
            console.log(error)
            interation.reply({ content: `Ocurrio un error al ejecutar el comando ${interation.commandName}`, ephemeral: true });
        }
    }
}