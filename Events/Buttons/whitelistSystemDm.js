
const sessionManager = require('../../utils/SessionManager');
const startWhitelist = require('../../handlers/startWhitelist');
const openModal = require('../../handlers/openModal');
const processAnswer = require('../../handlers/processAnswer');

module.exports = {
    name: 'interactionCreate',
    async execute(interaction) {
        try {
            if (!interaction.isButton() && !interaction.isModalSubmit() && !interaction.isStringSelectMenu()) return;

            // Iniciar formulario
            if (interaction.customId === 'whitelistSystem') {
                return await startWhitelist(interaction);
            }

            // Abrir modal
            if (interaction.customId.startsWith('openModal')) {
                const questionIndex = parseInt(interaction.customId.replace('openModal', ''), 10);
                return await openModal(interaction, questionIndex);
            }

            // Menú de selección
            if (interaction.isStringSelectMenu()) {
                const questionIndex = parseInt(interaction.customId.replace('selectMenu', ''), 10);
                return await processAnswer(interaction, questionIndex, interaction.values[0]);
            }

            // Respuesta de modal
            if (interaction.isModalSubmit() && interaction.customId.startsWith('responseModal')) {
                const questionIndex = parseInt(interaction.customId.replace('responseModal', ''), 10);
                const response = interaction.fields.getTextInputValue('response');
                return await processAnswer(interaction, questionIndex, response);
            }
        } catch (error) {
            console.error('Error en interactionCreate:', error);
            await sessionManager.cleanSession(interaction.user?.id);

            const reply = !interaction.deferred && !interaction.replied ? 'reply' : 'followUp';
            await interaction[reply]({
                content: '❌ Ocurrió un error inesperado. Intenta de nuevo más tarde.',
                ephemeral: true
            });
        }
    }
};