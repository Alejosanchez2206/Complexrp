const {
    SlashCommandBuilder,
    Client,
    PermissionFlagsBits,
    ChannelType,
    EmbedBuilder,
} = require('discord.js');

const permisosSchema = require('../../Models/addPermisos');
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

            //Verficar que rol tiene el usuario 
            const rolesUser = interaction.member.roles.cache.map(role => role.id).join(',');

            const rolesArray = rolesUser.split(',');

            const validarRol = await permisosSchema.find({ permiso: 'whitelist', guild: interaction.guild.id, rol: { $in: rolesArray } });

            if (validarRol.length === 0) {
                return interaction.reply({ content: 'No tienes permisos para usar este comando', ephemeral: true });
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