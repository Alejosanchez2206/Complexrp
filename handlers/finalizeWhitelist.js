const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const whitelistSchema = require('../Models/whitelistSystemSchema');
const sessionManager = require('../utils/SessionManager');

module.exports = async (interaction, session, responses) => {
    await interaction.update({ content: '✅ ¡Gracias por completar el formulario!', embeds: [], components: [], ephemeral: true });

    const responseData = await whitelistSchema.findOne({ guildId: interaction.guild.id });
    const channel = interaction.guild.channels.cache.get(responseData?.channelSend);

    if (!channel) {
        await sessionManager.cleanSession(interaction.user.id);
        return interaction.followUp({ content: '❌ No se encontró el canal de envío.', ephemeral: true });
    }

    const embed = new EmbedBuilder()
        .setTitle('📋 Formulario de Whitelist')
        .setColor('#FFD700')
        .addFields(
            { name: 'Usuario', value: interaction.user.tag, inline: true },
            { name: 'ID', value: interaction.user.id, inline: true }
        );

    responses.forEach((res, i) => {
        embed.addFields({
            name: `${i + 1}) ${session.questions[i].question}`,
            value: res || 'No respondido',
            inline: false
        });
    });

    embed.setFooter({ text: `ID: ${interaction.user.id}` });

    const buttonRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('WhitelistSystemAccept').setStyle(ButtonStyle.Success).setEmoji('✅').setLabel('Aceptar'),
        new ButtonBuilder().setCustomId('WhitelistSystemDeclineButton').setStyle(ButtonStyle.Danger).setEmoji('❌').setLabel('Denegar')
    );

    await channel.send({ embeds: [embed], components: [buttonRow] });
    await sessionManager.cleanSession(interaction.user.id);
};