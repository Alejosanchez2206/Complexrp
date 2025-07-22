const sessionManager = require('../../utils/SessionManager');
const startWhitelist = require('../../handlers/startWhitelist');
const openModal = require('../../handlers/openModal');
const processAnswer = require('../../handlers/processAnswer');

module.exports = {
    name: 'interactionCreate',
    async execute(interaction) {
        try {
            if (!interaction.isButton() && !interaction.isModalSubmit() && !interaction.isStringSelectMenu()) return;
            
            // Check if interaction is expired or already handled
            if (interaction.replied || interaction.deferred) {
                console.log('Interaction already handled');
                return;
            }

            // Iniciar formulario
            if (interaction.customId === 'whitelistSystem') {
                return await startWhitelist(interaction);
            }

            // Abrir modal
            if (interaction.customId.startsWith('openModal')) {
                const questionIndex = parseInt(interaction.customId.replace('openModal', ''), 10);
                if (isNaN(questionIndex)) {
                    console.error('Invalid questionIndex in openModal:', interaction.customId);
                    return;
                }
                return await openModal(interaction, questionIndex);
            }

            // Menú de selección
            if (interaction.isStringSelectMenu()) {
                const questionIndex = parseInt(interaction.customId.replace('selectMenu', ''), 10);
                if (isNaN(questionIndex)) {
                    console.error('Invalid questionIndex in selectMenu:', interaction.customId);
                    return;
                }
                return await processAnswer(interaction, questionIndex, interaction.values[0]);
            }

            // Respuesta de modal
            if (interaction.isModalSubmit() && interaction.customId.startsWith('responseModal')) {
                const questionIndex = parseInt(interaction.customId.replace('responseModal', ''), 10);
                if (isNaN(questionIndex)) {
                    console.error('Invalid questionIndex in responseModal:', interaction.customId);
                    return;
                }
                
                const response = interaction.fields.getTextInputValue('response');
                return await processAnswer(interaction, questionIndex, response);
            }

        } catch (error) {
            console.error('Error en interactionCreate:', error);
            
            // Clean up session on error
            if (interaction.user?.id) {
                await sessionManager.cleanSession(interaction.user.id);
            }

            // Only try to respond if we haven't already
            if (!interaction.replied && !interaction.deferred) {
                try {
                    await interaction.reply({
                        content: '❌ Ocurrió un error inesperado. Intenta de nuevo más tarde.',
                        ephemeral: true
                    });
                } catch (replyError) {
                    console.error('Failed to send error reply:', replyError);
                    // Try followUp if reply fails
                    try {
                        await interaction.followUp({
                            content: '❌ Ocurrió un error inesperado. Intenta de nuevo más tarde.',
                            ephemeral: true
                        });
                    } catch (followUpError) {
                        console.error('Failed to send error followUp:', followUpError);
                    }
                }
            }
        }
    }
};