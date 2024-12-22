const {
    SlashCommandBuilder,
    Client,
    ChatInputCommandInteraction,
    ChannelType
} = require('discord.js');

const permisosSchema = require('../../Models/addPermisos');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('anunciar')
        .setDescription('manda un anuncio')
        .addStringOption(option => option
            .setName('anuncio')
            .setDescription('Anuncio')
            .setRequired(true)
        )
        .addChannelOption(option =>
            option.setName('canal')
                .setDescription('Canal de anuncio')
                .setRequired(false)
                .addChannelTypes(ChannelType.GuildText)
        ),

    /**
     * @param {ChatInputCommandInteraction} interaction
     * @param {Client} client
     * @returns {Promise<void>}
     *      
     */

    async execute(interaction, client) {
        try {
            const anuncio = interaction.options.getString('anuncio'); // Tomar el anuncio directamente del input
            const canal = interaction.options.getChannel('canal') || interaction.channel;

            //Verficar que rol tiene el usuario 
            const rolesUser = interaction.member.roles.cache.map(role => role.id).join(',');

            const rolesArray = rolesUser.split(',');

            const validarRol = await permisosSchema.find({ permiso: 'annunciar', guild: interaction.guild.id, rol: { $in: rolesArray } });


            if (validarRol.length === 0) {
                return interaction.reply({ content: 'No tienes permisos para usar este comando', ephemeral: true });
            }

            // Reemplazar doble espacio con saltos de línea
            const anuncioConSaltos = anuncio.replace(/  /g, '\n');

            // Enviar el anuncio al canal especificado
            await canal.send({
                content: anuncioConSaltos // Mensaje procesado con saltos de línea
            });

            return interaction.reply({ content: 'Anuncio enviado', ephemeral: true });

        } catch (error) {
            console.error(`Error en el sistema de anuncios: ${error.message}`);
            interaction.reply({ content: 'Error en el sistema de anuncios', ephemeral: true });
        }
    }
}