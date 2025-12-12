const {
    SlashCommandBuilder,
    Client,
    PermissionFlagsBits,
    ChatInputCommandInteraction,
    ChannelType
} = require('discord.js');


const validarPermiso = require('../../utils/ValidarPermisos');

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
            // ===== VALIDAR PERMISOS =====
            const tienePermiso = await validarPermiso(interaction, 'seend_img');

            if (!tienePermiso) {
                return interaction.reply({
                    content: '❌ No tienes permisos para usar este comando\n> Necesitas el permiso: `seend_img`',
                    ephemeral: true
                });
            }

            const attachment = interaction.options.getAttachment('imagen');
            interaction.reply({ content: 'Imagen enviada', ephemeral: true });
            interaction.channel.send({ files: [attachment.url] });
        } catch (error) {
            console.log(error);
        }
    }
}