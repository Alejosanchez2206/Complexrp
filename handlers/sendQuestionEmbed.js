const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, StringSelectMenuBuilder , ButtonStyle } = require('discord.js');

module.exports = async (interaction, question, currentQuestion, totalQuestions) => {
    const embed = new EmbedBuilder()
        .setColor('#FFD700')
        .setTitle('📝 Responde la siguiente pregunta')
        .setDescription(question.question)
        .setFooter({ text: `Pregunta ${currentQuestion + 1} de ${totalQuestions}` });

    let components = [];
    if (question.type === 'select') {
        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId(`selectMenu${currentQuestion}`)
            .setPlaceholder('Selecciona una opción')
            .addOptions(question.options.map(option => ({ label: option, value: option })));

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
        await interaction.reply({ embeds: [embed], components, ephemeral: true });
    } else {
        await interaction.followUp({ embeds: [embed], components, ephemeral: true });
    }
};