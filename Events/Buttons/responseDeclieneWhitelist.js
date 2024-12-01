const { AttachmentBuilder, EmbedBuilder } = require('discord.js');
const whitelistSchema = require('../../Models/whitelistSystemSchema');
module.exports = {
    name: 'interactionCreate',
    async execute(interaction) {
        if (!interaction.isButton()) return;
        if (interaction.customId === 'WhitelistSystemDeclineButton') {
            const embed = interaction.message.embeds[0];
            const footer = embed.footer.text; // El texto del footer, e.g., "ID:672919914985816074"
            const id = footer.match(/\d+/)?.[0]; // Extraer solo los números usando una expresión regular

            const whitelist = await whitelistSchema.findOne({ guildId: interaction.guild.id });

            if (!whitelist) return interaction.reply({ content: 'No se ha configurado un sistema de whitelist.', ephemeral: true });

            const updatedEmbed = new EmbedBuilder(embed)
                .setTitle('Whitelist Rechazada')
                .setColor('#FF0000')
                .setFooter({ text: 'Rechazada por: ' + interaction.user.username, iconURL: interaction.user.displayAvatarURL() });

            // Actualizar el mensaje original con el nuevo embed
            await interaction.message.edit({ embeds: [updatedEmbed], components: [] });


            const channel = interaction.guild.channels.cache.get(whitelist.channelSend);
            await channel.send({ content: `<@${id}> Lo sentimos, su solicitud de whitelist ha sido rechazada.` });
        }
    }
}

