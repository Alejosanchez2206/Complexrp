const {
    SlashCommandBuilder,
    Client,
    PermissionFlagsBits,
    ChatInputCommandInteraction,
    ChannelType
} = require('discord.js');


const permisosSchema = require('../../Models/addPermisos');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('seend-img')
        .setDescription('manda una imagen')
        .addAttachmentOption(option => option
            .setName('imagen')
            .setDescription('imagen')
            .setRequired(true)
        ),

    /**
     * @param {ChatInputCommandInteraction} interaction
     * @param {Client} client
     * @returns {Promise<void>}
     *      
     */

    async execute(interaction, client) {
        try {
            if (!interaction.guild) return;
            const rolesUser = interaction.member.roles.cache.map(role => role.id).join(',');

            const rolesArray = rolesUser.split(',');

            const validarRol = await permisosSchema.find({ permiso: 'seend-img', guild: interaction.guild.id, rol: { $in: rolesArray } });


            if (validarRol.length === 0) {
                return interaction.reply({ content: 'No tienes permisos para usar este comando', ephemeral: true });
            }

            const attachment = interaction.options.getAttachment('imagen');
            interaction.reply({ content: 'Imagen enviada', ephemeral: true });
            interaction.channel.send({ files: [attachment.url] });
        } catch (error) {
            console.log(error);
        }
    }
}