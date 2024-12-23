const {
    ModalBuilder,
    ActionRowBuilder,
    TextInputBuilder,
    TextInputStyle,
    ButtonBuilder,
    EmbedBuilder,
    ButtonStyle,
    StringSelectMenuBuilder,
} = require('discord.js');

const questionsSchema = require('../../Models/questions');
const whitelistSchema = require('../../Models/whitelistSystemSchema');

// Sistema de gestión de sesiones mejorado
class SessionManager {
    constructor() {
        this.sessions = new Map();
        this.SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutos
    }

    createSession(userId, data) {
        const session = {
            ...data,
            timestamp: Date.now(),
        };
        this.sessions.set(userId, session);

        // Configurar limpieza automática
        setTimeout(() => {
            this.cleanSession(userId);
        }, this.SESSION_TIMEOUT);
    }

    getSession(userId) {
        const session = this.sessions.get(userId);
        if (!session) return null;

        // Verificar si la sesión ha expirado
        if (Date.now() - session.timestamp > this.SESSION_TIMEOUT) {
            this.cleanSession(userId);
            return null;
        }

        return session;
    }

    updateSession(userId, data) {
        const currentSession = this.getSession(userId);
        if (!currentSession) return false;

        const updatedSession = {
            ...currentSession,
            ...data,
            timestamp: Date.now(),
        };
        this.sessions.set(userId, updatedSession);
        return true;
    }

    cleanSession(userId) {
        this.sessions.delete(userId);
    }
}

const sessionManager = new SessionManager();

module.exports = {
    name: 'interactionCreate',

    async execute(interaction) {
        try {
            if (!interaction.isButton() && !interaction.isModalSubmit() && !interaction.isStringSelectMenu()) return;

            const button = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('WhitelistSystemAccept')
                        .setStyle(ButtonStyle.Success)
                        .setEmoji('✅')
                        .setLabel('Aceptar'),
                    new ButtonBuilder()
                        .setCustomId('WhitelistSystemDeclineButton')
                        .setStyle(ButtonStyle.Danger)
                        .setEmoji('❌')
                        .setLabel('Denegar')
                );

            const showModalForm = async (interaction, questionIndex) => {
                const modal = new ModalBuilder()
                    .setCustomId(`responseModal${questionIndex}`)
                    .setTitle('Responde a la pregunta');

                const answerInput = new TextInputBuilder()
                    .setCustomId('response')
                    .setLabel('Escribe tu respuesta')
                    .setStyle(TextInputStyle.Paragraph)
                    .setRequired(true)
                    .setMinLength(2)
                    .setMaxLength(900);

                const actionRow = new ActionRowBuilder().addComponents(answerInput);
                modal.addComponents(actionRow);

                await interaction.showModal(modal);
            };

            const sendQuestionEmbed = async (interaction, question, currentQuestion, totalQuestions) => {
                const embed = new EmbedBuilder()
                    .setColor('#FFD700')
                    .setTitle('Responde la siguiente pregunta')
                    .setDescription(question.question)
                    .setFooter({ text: `Pregunta ${currentQuestion + 1} de ${totalQuestions}` });

                let components = [];

                if (question.type === 'select') {
                    const selectMenu = new StringSelectMenuBuilder()
                        .setCustomId(`selectMenu${currentQuestion}`)
                        .setPlaceholder('Selecciona una opción')
                        .addOptions(
                            question.options.map(option => ({
                                label: option,
                                value: option,
                            }))
                        );

                    components = [new ActionRowBuilder().addComponents(selectMenu)];
                } else {
                    const button = new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                            .setCustomId(`openModal${currentQuestion}`)
                            .setStyle(ButtonStyle.Primary)
                            .setLabel('Responder')
                    );
                    components = [button];
                }

                if (!interaction.replied && !interaction.deferred) {
                    await interaction.reply({ embeds: [embed], components: components, ephemeral: true });
                } else {
                    await interaction.followUp({ embeds: [embed], components: components, ephemeral: true });
                }
            };

            if (interaction.customId === 'whitelistSystem') {
                const rolesUser = interaction.member.roles.cache.map(role => role.id);
                const responseData = await whitelistSchema.findOne({ guildId: interaction.guild.id });

                if (!responseData || !responseData.channelSend) {
                    return interaction.reply({ content: 'Configuración de whitelist no válida.', ephemeral: true });
                }

                if (rolesUser.includes(responseData.roleId)) {
                    return interaction.reply({ content: '❌ Ya has sido verificado.', ephemeral: true });
                }

                const guildId = interaction.guild.id;
                const questionsWithoutOptions = await questionsSchema.aggregate([
                    { $match: { guildId: guildId, type: 'text' } },
                    { $sample: { size: 5 } }
                ]);
                const questionsWithOptions = await questionsSchema.aggregate([
                    { $match: { guildId: guildId, type: 'select' } },
                    { $sample: { size: 5 } }
                ]);

                const questionsPerson = [
                    { question: '¿Qué edad tienes (OC)?', type: 'text' },
                    { question: '¿Por qué quieres ser parte de la comunidad? ¿Qué servidores has visitado?', type: 'text' },
                    { question: 'Escribe la historia de tu personaje , (Si superas los 900 caracteres, puedes subir un enlace de google doc con tu historia.)', type: 'text' },
                ];

                const questions = [...questionsWithoutOptions, ...questionsWithOptions, ...questionsPerson];

                if (questions.length === 0) {
                    return interaction.reply({ content: 'No hay preguntas disponibles', ephemeral: true });
                }

                // Crear nueva sesión
                sessionManager.createSession(interaction.user.id, {
                    currentQuestion: 0,
                    responses: [],
                    questions
                });

                await sendQuestionEmbed(interaction, questions[0], 0, questions.length);

            } else if (interaction.customId.startsWith('openModal')) {
                const questionIndex = parseInt(interaction.customId.replace('openModal', ''));
                const session = sessionManager.getSession(interaction.user.id);

                if (!session) {
                    return interaction.reply({
                        content: 'Tu sesión ha expirado o no es válida. Por favor, inicia el proceso nuevamente usando el botón de whitelist.',
                        ephemeral: true
                    });
                }

                await showModalForm(interaction, questionIndex);

            } else if (interaction.isStringSelectMenu()) {
                const questionIndex = parseInt(interaction.customId.replace('selectMenu', ''));
                const response = interaction.values[0];
                const session = sessionManager.getSession(interaction.user.id);

                if (!session) {
                    return interaction.reply({
                        content: 'Tu sesión ha expirado o no es válida. Por favor, inicia el proceso nuevamente usando el botón de whitelist.',
                        ephemeral: true
                    });
                }

                const updatedResponses = [...session.responses];
                updatedResponses[questionIndex] = response;

                const success = sessionManager.updateSession(interaction.user.id, {
                    responses: updatedResponses,
                    currentQuestion: session.currentQuestion + 1
                });

                if (!success) {
                    return interaction.reply({
                        content: 'Hubo un error al procesar tu respuesta. Por favor, intenta nuevamente.',
                        ephemeral: true
                    });
                }

                if (session.currentQuestion + 1 < session.questions.length) {
                    await interaction.deferUpdate();
                    await sendQuestionEmbed(interaction, session.questions[session.currentQuestion + 1], session.currentQuestion + 1, session.questions.length);
                } else {
                    await interaction.update({ content: 'Gracias por responder todas las preguntas!', embeds: [], components: [], ephemeral: true });

                    const responseData = await whitelistSchema.findOne({ guildId: interaction.guild.id });
                    const channel = interaction.guild.channels.cache.get(responseData.channelSend);

                    if (!channel) {
                        sessionManager.cleanSession(interaction.user.id);
                        return interaction.followUp({ content: 'No se encontró el canal para enviar el formulario.', ephemeral: true });
                    }

                    const embed = new EmbedBuilder()
                        .setTitle('Formulario de Whitelist')
                        .setColor('#FFD700')
                        .setDescription('**Información del formulario:**')
                        .addFields(
                            { name: 'Nombre', value: interaction.user.username, inline: true },
                            { name: 'ID', value: interaction.user.id, inline: true }
                        );

                    for (let i = 0; i < updatedResponses.length; i++) {
                        embed.addFields({
                            name: `${i + 1}) ${session.questions[i].question}`,
                            value: updatedResponses[i]?.toString() || 'No respondido',
                            inline: false
                        });
                    }

                    embed.setFooter({ text: 'ID:' + interaction.user.id });
                    await channel.send({ embeds: [embed], components: [button] });

                    sessionManager.cleanSession(interaction.user.id);
                }

            } else if (interaction.isModalSubmit()) {
                const questionIndex = parseInt(interaction.customId.replace('responseModal', ''));
                const response = interaction.fields.getTextInputValue('response');
                const session = sessionManager.getSession(interaction.user.id);

                if (!session) {
                    return interaction.reply({
                        content: 'Tu sesión ha expirado o no es válida. Por favor, inicia el proceso nuevamente usando el botón de whitelist.',
                        ephemeral: true
                    });
                }

                const updatedResponses = [...session.responses];
                updatedResponses[questionIndex] = response;

                const success = sessionManager.updateSession(interaction.user.id, {
                    responses: updatedResponses,
                    currentQuestion: session.currentQuestion + 1
                });

                if (!success) {
                    return interaction.reply({
                        content: 'Hubo un error al procesar tu respuesta. Por favor, intenta nuevamente.',
                        ephemeral: true
                    });
                }

                if (session.currentQuestion + 1 < session.questions.length) {
                    await interaction.deferUpdate();
                    await sendQuestionEmbed(interaction, session.questions[session.currentQuestion + 1], session.currentQuestion + 1, session.questions.length);
                } else {
                    await interaction.update({ content: 'Gracias por responder todas las preguntas!', embeds: [], components: [], ephemeral: true });

                    const responseData = await whitelistSchema.findOne({ guildId: interaction.guild.id });
                    const channel = interaction.guild.channels.cache.get(responseData.channelSend);

                    if (!channel) {
                        sessionManager.cleanSession(interaction.user.id);
                        return interaction.followUp({ content: 'No se encontró el canal para enviar el formulario.', ephemeral: true });
                    }

                    const embed = new EmbedBuilder()
                        .setTitle('Formulario de Whitelist')
                        .setColor('#FFD700')
                        .setDescription('**Información del formulario:**')
                        .addFields(
                            { name: 'Nombre', value: interaction.user.username, inline: true },
                            { name: 'ID', value: interaction.user.id, inline: true }
                        );

                    for (let i = 0; i < updatedResponses.length; i++) {
                        embed.addFields({
                            name: `${i + 1}) ${session.questions[i].question}`,
                            value: updatedResponses[i]?.toString() || 'No respondido',
                            inline: false
                        });
                    }

                    embed.setFooter({ text: 'ID:' + interaction.user.id });
                    await channel.send({ embeds: [embed], components: [button] });

                    sessionManager.cleanSession(interaction.user.id);
                }
            }
        } catch (error) {
            console.error('Error en el manejo de interacción:', error);

            // Limpiar la sesión en caso de error
            if (interaction.user) {
                sessionManager.cleanSession(interaction.user.id);
            }

            if (!interaction.deferred && !interaction.replied) {
                await interaction.reply({
                    content: 'Se produjo un error inesperado. Por favor, inicia el proceso nuevamente.',
                    ephemeral: true
                });
            } else {
                await interaction.followUp({
                    content: 'Se produjo un error inesperado. Por favor, inicia el proceso nuevamente.',
                    ephemeral: true
                });
            }
        }
    }
};