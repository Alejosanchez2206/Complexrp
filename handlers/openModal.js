const { ModalBuilder, ActionRowBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');

module.exports = async (interaction, questionIndex) => {
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

    modal.addComponents(new ActionRowBuilder().addComponents(answerInput));
    await interaction.showModal(modal);
};