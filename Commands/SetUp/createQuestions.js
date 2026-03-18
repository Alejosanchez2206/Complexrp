const {
    SlashCommandBuilder,
    Client,
    PermissionFlagsBits,
    ChatInputCommandInteraction,
} = require('discord.js');

const validarPermiso  = require('../../utils/ValidarPermisos');
const questionsSchema = require('../../Models/questions');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('add-questions')
        .setDescription('Añade preguntas al servidor')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addStringOption(option =>
            option
                .setName('pregunta')
                .setDescription('Escribe la pregunta que deseas añadir')
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName('opciones')
                .setDescription('Opciones de la pregunta separadas por coma  Ej: "Opción 1, Opción 2, Opción 3"')
                .setRequired(false)
        )
        .addStringOption(option =>
            option
                .setName('tipo')
                .setDescription('Tipo de pregunta')
                .setRequired(false)
                .addChoices(
                    { name: '📝 Texto',    value: 'text'     },
                    { name: '🔘 Selección', value: 'select' },
                 
                )
        ),

    /**
     * @param {ChatInputCommandInteraction} interaction
     * @param {Client} client
     */
    async execute(interaction, client) {
        try {
            const pregunta = interaction.options.getString('pregunta');
            const tipo     = interaction.options.getString('tipo')     ?? null;
            const opciones = interaction.options.getString('opciones') ?? null;

            // Convierte "Opción 1, Opción 2" → ['Opción 1', 'Opción 2']
            const opcionesArray = opciones
                ? opciones.split(',').map(o => o.trim()).filter(Boolean)
                : [];

            // ===== VALIDAR PERMISOS =====
            const tienePermiso = await validarPermiso(interaction, 'whitelist');

            if (!tienePermiso) {
                return interaction.reply({
                    content: '❌ No tienes permisos para usar este comando.\n> Necesitas el permiso: `whitelist`',
                    ephemeral: true,
                });
            }

            // ===== CREAR PREGUNTA =====
            const question = await questionsSchema.create({
                guildId:  interaction.guild.id,
                question: pregunta,
                options:  opcionesArray,
                type:     tipo,
            });

            return interaction.reply({
                content: question
                    ? '✅ Pregunta añadida correctamente.'
                    : '❌ Error al añadir la pregunta.',
                ephemeral: true,
            });

        } catch (error) {
            console.error('[add-questions]', error);

            const reply = interaction.replied || interaction.deferred
                ? interaction.followUp.bind(interaction)
                : interaction.reply.bind(interaction);

            reply({
                content: '❌ Ocurrió un error al ejecutar el comando, inténtalo de nuevo.',
                ephemeral: true,
            });
        }
    },
};