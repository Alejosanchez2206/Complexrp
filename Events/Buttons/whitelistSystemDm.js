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

// Mapeo de estado por usuario
const userStates = new Map();

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

            async function showModalForm(interaction, question, questionIndex) {
                const modal = new ModalBuilder()
                    .setCustomId(`responseModal${questionIndex}`)
                    .setTitle('Responde a la pregunta');

                const answerInput = new TextInputBuilder()
                    .setCustomId('response')
                    .setLabel('Escribe tu respuesta')
                    .setStyle(TextInputStyle.Paragraph)
                    .setRequired(true)
                    .setMinLength(20)
                    .setMaxLength(900);

                const actionRow = new ActionRowBuilder().addComponents(answerInput);
                modal.addComponents(actionRow);

                await interaction.showModal(modal);
            }

            async function sendQuestionEmbed(interaction, question, currentQuestion, totalQuestions) {
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
            }

            if (interaction.customId === 'whitelistSystem') {
                const rolesUser = interaction.member.roles.cache.map(role => role.id);
                const responseData = await whitelistSchema.findOne({ guildId: interaction.guild.id });

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

                const questions = [...questionsWithoutOptions, ...questionsWithOptions, {
                    question: 'Escribe la historia de tu personaje , (Si superas los 900 caracteres, puedes subir un enlace de google doc con tu historia.)',
                    type: 'text'
                }];

                if (questions.length === 0) {
                    return interaction.reply({ content: 'No hay preguntas disponibles', ephemeral: true });
                }

                userStates.set(interaction.user.id, {
                    currentQuestion: 0,
                    responses: [],
                    questions
                });

                await sendQuestionEmbed(interaction, questions[0], 0, questions.length);

            } else if (interaction.customId.startsWith('openModal')) {
                const questionIndex = parseInt(interaction.customId.replace('openModal', ''));
                const state = userStates.get(interaction.user.id);

                if (!state) {
                    return interaction.reply({ content: 'Hubo un problema con tu sesión. Por favor, intenta de nuevo.', ephemeral: true });
                }

                await showModalForm(interaction, state.questions[questionIndex], questionIndex);

            } else if (interaction.isStringSelectMenu()) {
                const questionIndex = parseInt(interaction.customId.replace('selectMenu', ''));
                const response = interaction.values[0];
                const state = userStates.get(interaction.user.id);

                if (!state) {
                    return interaction.reply({ content: 'Hubo un problema con tu sesión. Por favor, intenta de nuevo.', ephemeral: true });
                }

                state.responses[questionIndex] = response;
                state.currentQuestion++;

                if (state.currentQuestion < state.questions.length) {
                    await interaction.deferUpdate();
                    await sendQuestionEmbed(interaction, state.questions[state.currentQuestion], state.currentQuestion, state.questions.length);
                } else {
                    await interaction.update({ content: 'Gracias por responder todas las preguntas!', embeds: [], components: [], ephemeral: true });

                    const responseData = await whitelistSchema.findOne({ guildId: interaction.guild.id });
                    const channel = interaction.guild.channels.cache.get(responseData.channelSend);

                    const embed = new EmbedBuilder()
                        .setTitle('Formulario de Whitelist')
                        .setColor('#FFD700')
                        .setDescription('**Información del formulario:**')
                        .addFields(
                            { name: 'Nombre', value: interaction.user.username, inline: true },
                            { name: 'ID', value: interaction.user.id, inline: true }
                        );

                    for (let i = 0; i < state.responses.length; i++) {
                        embed.addFields({ name: `${state.questions[i].question}`, value: state.responses[i], inline: false });
                    }

                    embed.setFooter({ text: 'ID:' + interaction.user.id });
                    await channel.send({ embeds: [embed], components: [button] });

                    userStates.delete(interaction.user.id);
                }
            } else if (interaction.isModalSubmit()) {
                const questionIndex = parseInt(interaction.customId.replace('responseModal', ''));
                const response = interaction.fields.getTextInputValue('response');
                const state = userStates.get(interaction.user.id);

                if (!state) {
                    return interaction.reply({ content: 'Hubo un problema con tu sesión. Por favor, intenta de nuevo.', ephemeral: true });
                }

                state.responses[questionIndex] = response;
                state.currentQuestion++;

                if (state.currentQuestion < state.questions.length) {
                    await interaction.deferUpdate();
                    await sendQuestionEmbed(interaction, state.questions[state.currentQuestion], state.currentQuestion, state.questions.length);
                } else {
                    await interaction.update({ content: 'Gracias por responder todas las preguntas!', embeds: [], components: [], ephemeral: true });

                    const responseData = await whitelistSchema.findOne({ guildId: interaction.guild.id });
                    const channel = interaction.guild.channels.cache.get(responseData.channelSend);

                    const embed = new EmbedBuilder()
                        .setTitle('Formulario de Whitelist')
                        .setColor('#FFD700')
                        .setDescription('**Información del formulario:**')
                        .addFields(
                            { name: 'Nombre', value: interaction.user.username, inline: true },
                            { name: 'ID', value: interaction.user.id, inline: true }
                        );

                    for (let i = 0; i < state.responses.length; i++) {
                        embed.addFields({ name: `${state.questions[i].question}`, value: state.responses[i], inline: false });
                    }

                    embed.setFooter({ text: 'ID:' + interaction.user.id });
                    await channel.send({ embeds: [embed], components: [button] });

                    userStates.delete(interaction.user.id);
                }
            }
        } catch (error) {
            console.error(error);
            if (!interaction.deferred && !interaction.replied) {
                await interaction.reply({ content: 'Error al enviar el formulario', ephemeral: true });
            } else {
                await interaction.followUp({ content: 'Error al enviar el formulario', ephemeral: true });
            }
        }
    }
};
