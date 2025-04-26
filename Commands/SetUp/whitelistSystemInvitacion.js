const {
    SlashCommandBuilder,
    Client,
    PermissionFlagsBits,
    ChannelType,
    EmbedBuilder,
    ButtonBuilder,
    ActionRowBuilder,
    ButtonStyle,
    ComponentType
} = require('discord.js');

const buttons = new ActionRowBuilder()
    .addComponents(
        new ButtonBuilder()
            .setCustomId('WhitelistSystemInvitation')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('✅')
            .setLabel('Activar'),

        new ButtonBuilder()
            .setCustomId('WhitelistSystemInvitationD')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('❌')
            .setLabel('Desactivar'),
    );

const buttonsObtener = new ActionRowBuilder()
    .addComponents(
        new ButtonBuilder()
            .setCustomId('WhitelistSystemInvitationObtener')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('✅')
            .setLabel('Obtener invitaciones'),
    );


module.exports = {
    data: new SlashCommandBuilder()
        .setName('whitelist-system-invitation')
        .setDescription('Muestra los anuncios')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addChannelOption(option =>
            option.setName('channel')
                .setDescription('Canal de anuncios')
                .setRequired(true)
                .addChannelTypes(ChannelType.GuildText)
        )
        .addStringOption(option =>
            option.setName('message')
                .setDescription('Mensaje de anuncios')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('image')
                .setDescription('Imagen de anuncios')
                .setRequired(false)
        )
        .addStringOption(option =>
            option.setName('color')
                .setDescription('Color de anuncios')
                .setRequired(false)
                .setMinLength(3)
                .setMaxLength(7)
                .setMaxLength(32)
        )
        .addStringOption(option =>
            option.setName('title')
                .setDescription('Titulo de anuncios')
                .setRequired(false)
                .setMaxLength(256)
        ),
 
    /** 
     * @param {ChatInputCommandInteraction} interaction
     * @param {Client} client
     * @returns {Promise<void>} 
     */
    async execute(interaction, client) {
        const channel = interaction.options.getChannel('channel');
        const message = interaction.options.getString('message').replace(/\\n/g, '\n').substring(0, 2000);;
        const image = interaction.options.getString('image');
        const color = interaction.options.getString('color');
        const title = interaction.options.getString('title') || 'Sistema de invitaciones';

        const embed = new EmbedBuilder()
            .setTitle(title)
            .setDescription(message)
            .setColor(color)
            .setImage(image)
            .setFooter({ text: 'Complex community', iconURL: client.user.displayAvatarURL() });

        const systemMessage = await interaction.reply({
            content: 'Sistema de invitaciones activado',
            embeds: [embed],
            components: [buttons],
            ephemeral: true,
        });

        const confirmation = await systemMessage.awaitMessageComponent({
            filter: i => i.user.id === interaction.user.id,
            componentType: ComponentType.Button,
            time: 60000,
        });

        if (confirmation.customId === 'WhitelistSystemInvitation') {
            await confirmation.update({

                embeds: [embed],
                components: [],
                ephemeral: true,
            });

            await channel.send({ embeds: [embed] , components: [buttonsObtener] });
            await interaction.followUp({ content: 'Sistema de invitaciones activado', ephemeral: true });
        }

        if (confirmation.customId === 'WhitelistSystemInvitationD') {
            await interaction.followUp({ content: 'Sistema de invitaciones desactivado', ephemeral: true });
        }
        

    }
}