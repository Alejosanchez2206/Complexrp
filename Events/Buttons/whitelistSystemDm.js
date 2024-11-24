const {
    ModalBuilder,
    ActionRowBuilder,
    TextInputBuilder,
    TextInputStyle,
    ButtonBuilder,
    EmbedBuilder,
    ButtonStyle
} = require('discord.js');

const questionsSchema = require('../../Models/questions');
const whitelistSchema = require('../../Models/whitelistSystemSchema');
const state = {};

module.exports = {
    name: 'interactionCreate',

    async execute(interaction) {
        try {
            if (!interaction.isButton() && !interaction.isModalSubmit()) return;
            async function showModalForm(interaction, question, questionIndex) {
                const modal = new ModalBuilder()
                    .setCustomId(`responseModal${questionIndex}`)
                    .setTitle('Responde a la pregunta');

                const answerInput = new TextInputBuilder()
                    .setCustomId('response')
                    .setLabel('Escribe tu respuesta')
                    .setStyle(TextInputStyle.Paragraph)
                    .setRequired(true);

                const actionRow = new ActionRowBuilder().addComponents(answerInput);
                modal.addComponents(actionRow);

                await interaction.showModal(modal);
            }

            async function sendQuestionEmbed(interaction, question, currentQuestion, totalQuestions) {
                const embed = new EmbedBuilder()
                    .setColor('#FFD700')
                    .setTitle('Responde la siguiente pregunta')
                    .setDescription(question)
                    .setFooter({ text: `Pregunta ${currentQuestion + 1} de ${totalQuestions}` });

                const button = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId(`openModal${currentQuestion}`)
                        .setStyle(ButtonStyle.Primary)
                        .setLabel('Responder')
                );

                if (!interaction.replied && !interaction.deferred) {
                    await interaction.reply({ embeds: [embed], components: [button], ephemeral: true });
                } else {
                    await interaction.followUp({ embeds: [embed], components: [button], ephemeral: true });
                }
            }

            if (interaction.customId === 'whitelistSystem') {
                const questions = await questionsSchema.aggregate([
                    {
                        $match: {
                            guildId: interaction.guild.id
                        }
                    },
                    {
                        $sample: {
                            size: 9
                        }
                    }
                ]);

                questions.push({
                    question: 'Escribe la historia de tu personaje'
                });

                if (questions.length === 0) {
                    return interaction.reply({ content: 'No hay preguntas disponibles', ephemeral: true });
                }

                state[interaction.user.id] = {
                    currentQuestion: 0,
                    responses: [],
                    questions
                };

                await sendQuestionEmbed(interaction, questions[0].question, 0, questions.length);

            } else if (interaction.customId.startsWith('openModal')) {
                const questionIndex = parseInt(interaction.customId.replace('openModal', ''));
                const { questions } = state[interaction.user.id];
                const question = questions[questionIndex];

                await showModalForm(interaction, question.question, questionIndex);

            } else if (interaction.isModalSubmit()) {
                const questionIndex = parseInt(interaction.customId.replace('responseModal', ''));
                const response = interaction.fields.getTextInputValue('response');
                const userId = interaction.user.id;

                if (!state[userId]) {
                    return interaction.reply({ content: 'Hubo un problema con tu sesión. Por favor, intenta de nuevo.', ephemeral: true });
                }

                state[userId].responses[questionIndex] = response;
                state[userId].currentQuestion++;

                const { currentQuestion, questions } = state[userId];

                if (currentQuestion < questions.length) {
                    await interaction.deferUpdate(); 
                    await sendQuestionEmbed(interaction, questions[currentQuestion].question, currentQuestion, questions.length);
                } else {
                    await interaction.update({ content: 'Gracias por responder todas las preguntas!', embeds: [], components: [], ephemeral: true });

                    const responseData = await whitelistSchema.findOne({ guildId: interaction.guild.id });
                    const channel = interaction.guild.channels.cache.get(responseData.channelId);

                    const embed = new EmbedBuilder()
                        .setTitle('Formulario de Whitelist')
                        .setColor('#FFD700')
                        .setDescription('**Información del formulario:**')
                        .addFields(
                            { name: 'Nombre', value: interaction.user.username, inline: true },
                            { name: 'ID', value: interaction.user.id, inline: true }
                        );

                    for (let i = 0; i < state[userId].responses.length; i++) {
                        embed.addFields({ name: `${questions[i].question}`, value: state[userId].responses[i], inline: false });
                    }
                    embed.setFooter({ text: 'ID:' + interaction.user.id });

                    await channel.send({ embeds: [embed] });

                    delete state[userId];
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
