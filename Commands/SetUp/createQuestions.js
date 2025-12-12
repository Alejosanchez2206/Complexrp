const {
    SlashCommandBuilder,
    Client,
    PermissionFlagsBits,
    ChannelType,
    EmbedBuilder,
} = require('discord.js');

const validarPermiso = require('../../utils/ValidarPermisos');
const questionsSchema = require('../../Models/questions');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('add-questions')
        .setDescription('Añade preguntas')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addStringOption(option =>
            option.setName('pregunta')
                .setDescription('Pregunta')
                .setRequired(true)
        ),

    /**
     * @param {ChatInputCommandInteraction} interaction 
     * @param {Client} client
     *  
     */
    async execute(interaction, client) {
        try {
            const pregunta = interaction.options.getString('pregunta');

            // ===== VALIDAR PERMISOS =====
            const tienePermiso = await validarPermiso(interaction, 'whitelist');

            if (!tienePermiso) {
                return interaction.reply({
                    content: '❌ No tienes permisos para usar este comando\n> Necesitas el permiso: `whitelist`',
                    ephemeral: true
                });
            }
            const question = await questionsSchema.create({
                question: pregunta,
                guildId: interaction.guild.id
            });

            if (question) {
                return interaction.reply({ content: 'Pregunta añadida correctamente', ephemeral: true });
            } else {
                return interaction.reply({ content: 'Error al añadir la pregunta', ephemeral: true });
            }

        } catch (error) {
            console.log(error);
            interaction.reply({ content: 'Error al ejecutar el comando de añadir preguntas , intenta de nuevo', ephemeral: true });
        }
    }
}