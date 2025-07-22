
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const whitelistSchema = require('../Models/whitelistSystemSchema');
const sessionManager = require('../utils/SessionManager');
const sendQuestionEmbed = require('./sendQuestionEmbed');
const finalizeWhitelist = require('./finalizeWhitelist');

module.exports = async (interaction, questionIndex, response) => {
    const session = await sessionManager.getSession(interaction.user.id);
    if (!session) {
        return interaction.reply({
            content: '🕒 Tu sesión ha expirado. Por favor, inicia el proceso nuevamente.',
            ephemeral: true
        });
    }

    const updatedResponses = [...session.responses];
    updatedResponses[questionIndex] = response;

    const success = await sessionManager.updateSession(interaction.user.id, {
        responses: updatedResponses,
        currentQuestion: session.currentQuestion + 1
    });

    if (!success) {
        return interaction.reply({
            content: '⚠️ Error al guardar tu respuesta. Intenta de nuevo.',
            ephemeral: true
        });
    }

    if (session.currentQuestion + 1 < session.questions.length) {
        await interaction.deferUpdate();
        await sendQuestionEmbed(
            interaction,
            session.questions[session.currentQuestion + 1],
            session.currentQuestion + 1,
            session.questions.length
        );
    } else {
        await finalizeWhitelist(interaction, session, updatedResponses);
    }
};