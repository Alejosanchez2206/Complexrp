const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const whitelistSchema = require('../Models/whitelistSystemSchema');
const sessionManager = require('../utils/SessionManager');
const sendQuestionEmbed = require('./sendQuestionEmbed');
const finalizeWhitelist = require('./finalizeWhitelist');

module.exports = async (interaction, questionIndex, response) => {
    // Check if interaction is still valid
    if (!interaction || interaction.replied || interaction.deferred) {
        console.log('Interaction is no longer valid or already responded to');
        return;
    }

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
        // Use deferUpdate ONLY if we haven't already responded
        try {
            if (!interaction.replied && !interaction.deferred) {
                await interaction.deferUpdate();
            }
            
            await sendQuestionEmbed(
                interaction,
                session.questions[session.currentQuestion + 1],
                session.currentQuestion + 1,
                session.questions.length
            );
        } catch (error) {
            console.error('Error updating interaction:', error);
            // If deferUpdate fails, try to reply normally
            if (!interaction.replied) {
                try {
                    await interaction.reply({
                        content: '⚠️ Error al procesar la respuesta. Reiniciando...',
                        ephemeral: true
                    });
                } catch (replyError) {
                    console.error('Failed to reply after deferUpdate error:', replyError);
                }
            }
        }
    } else {
        await finalizeWhitelist(interaction, session, updatedResponses);
    }
};