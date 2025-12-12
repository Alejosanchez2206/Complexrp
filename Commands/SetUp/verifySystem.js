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

const validarPermiso = require('../../utils/ValidarPermisos');

const whitelistSchema = require('../../Models/verifySchema');

const buttons = new ActionRowBuilder()
    .addComponents(
        new ButtonBuilder()
            .setCustomId('WhitelistSystem')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('✅')
            .setLabel('Activar'),

        new ButtonBuilder()
            .setCustomId('WhitelistSystemD')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('❌')
            .setLabel('Desactivar'),
    );

const urlImgRegex = /(https?:\/\/.*\.(?:png|jpg|gif|webp))/i;
const colorRegex = /^#([0-9a-f]{3}){1,2}$/i;


module.exports = {
    data: new SlashCommandBuilder()
        .setName('verify-system')
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
                .setMaxLength(32)
        )
        .addRoleOption(option =>
            option.setName('role')
                .setDescription('Role de la lista blanca')
                .setRequired(false)
        )
        .addChannelOption(option =>
            option.setName('channel-result')
                .setDescription('Canal donde se enviaran los resultados')
                .setRequired(false)
        ),

    /**
     * @param {ChatInputCommandInteraction} interaction
     * @param {Client} client
     *  */

    async execute(interaction, client) {
        try {
            if (!interaction.guild) return;
            if (!interaction.isChatInputCommand()) return;

            const button = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('verifySystem')
                        .setStyle(ButtonStyle.Success)
                        .setLabel('Verificar'),

                )

            // ===== VALIDAR PERMISOS =====
            const tienePermiso = await validarPermiso(interaction, 'whitelist');

            if (!tienePermiso) {
                return interaction.reply({
                    content: '❌ No tienes permisos para usar este comando\n> Necesitas el permiso: `whitelist`',
                    ephemeral: true
                });
            }

            let systemMessage;
            const message = interaction.options.getString('message').replace(/\\n/g, '\n').substring(0, 2000);
            const image = urlImgRegex.test(interaction.options.getString('image')) ? interaction.options.getString('image') : interaction.guild.iconURL();
            const color = colorRegex.test(interaction.options.getString('color')) ? interaction.options.getString('color') : '#000000';
            const channel = interaction.options.getChannel('channel');
            const role = interaction.options.getRole('role');
            const channelResult = interaction.options.getChannel('channel-result');

            const data = await whitelistSchema.findOne({ guildId: interaction.guild.id });

            if (data) {
                await whitelistSchema.findOneAndDelete({ guildId: interaction.guild.id });
            }

            const embed = new EmbedBuilder()
                .setDescription(message)
                .setColor(color)
                .setImage(image)

            systemMessage = await interaction.reply({
                content: 'Preview del sistema de anuncios\nEn caso de ser correcto presione el botón de aceptar',
                embeds: [embed],
                components: [buttons],
                ephemeral: true
            });

            const confirmation = await systemMessage.awaitMessageComponent({
                filter: i => i.user.id === interaction.user.id,
                time: 30000,
                componentType: ComponentType.Button
            });

            if (confirmation.customId === 'WhitelistSystem') {
                const message = await interaction.guild.channels.cache.get(channel.id).send(
                    {
                        embeds: [embed],
                        components: [button]
                    });


                await whitelistSchema.create({
                    guildId: interaction.guild.id,
                    channelId: channel.id,
                    messageId: message.id,
                    roleId: role.id,
                    channelResultId: channelResult.id
                });
                await systemMessage?.edit({ content: 'Sistema enviado con exito', components: [], ephemeral: true });
            } else if (confirmation.customId === 'WhitelistSystemD') {
                await systemMessage?.edit({ content: 'Sistema desactivado con exito', components: [], ephemeral: true });
            }

        } catch (error) {
            console.log(error);
            interaction.reply({ content: `Ocurrio un error al ejecutar el comando ${interaction.commandName}`, ephemeral: true });
        }
    }
}
