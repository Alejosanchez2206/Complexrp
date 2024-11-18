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
            .setCustomId('welcomeSystem')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('✅')
            .setLabel('Activar'),

        new ButtonBuilder()
            .setCustomId('welcomeSystemD')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('❌')
            .setLabel('Desactivar'),
    );

const welcomeSchema = require('../../Models/welcomeSchema');
const urlImgRegex = /(https?:\/\/.*\.(?:png|jpg|gif|webp))/i;
const colorRegex = /^#([0-9a-f]{3}){1,2}$/i;

module.exports = {
    data: new SlashCommandBuilder()
        .setName('welcome-system')
        .setDescription('Activar sistema de bienvenida')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addStringOption(option =>
            option.setName('message')
                .setDescription('Mensaje de bienvenida')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('image')
                .setDescription('Imagen de bienvenida')
                .setRequired(false)
        )
        .addStringOption(option =>
            option.setName('color')
                .setDescription('Color de bienvenida')
                .setRequired(false)
                .setMinLength(3)
                .setMaxLength(32)
        )
        .addChannelOption(option =>
            option.setName('channel')
                .setDescription('Canal de bienvenida')
                .setRequired(false)
                .addChannelTypes(ChannelType.GuildText)
            
        ),


    /** 
     * @param {ChatInputCommandInteraction} interaction
     * @param {Client} client
     * @returns {Promise<void>}
     *      
     */


    async execute(interaction, client) {
        let systemMessage;
        try {
            const message = interaction.options.getString('message').replace(/\\n/g, '\n').substring(0, 2000);
            const image = urlImgRegex.test(interaction.options.getString('image')) ? interaction.options.getString('image') : interaction.guild.iconURL();
            const color = colorRegex.test(interaction.options.getString('color')) ? interaction.options.getString('color') : '#000000';
            const channel = interaction.options.getChannel('channel');

            const embed = new EmbedBuilder()
                .setAuthor({ name: 'Sistema de bienvenida', iconURL: client.user.displayAvatarURL() })
                .setDescription(message)
                .setColor(color)
                .setImage(image)
                .setFooter({ text: 'Sistema de bienvenida', iconURL: client.user.displayAvatarURL() });

            systemMessage = await interaction.reply({
                content: 'Preview del sistema de bienvenida\nEn caso de ser correcto presione el botón de aceptar',
                embeds: [embed],
                components: [buttons],
            });

            const confirmation = await systemMessage.awaitMessageComponent({
                filter: i => i.user.id === interaction.user.id,
                time: 30000,
                componentType: ComponentType.Button
            });

            if (confirmation.customId === 'welcomeSystem') {
                const data = await welcomeSchema.findOne({ guilId: interaction.guild.id });

                if (data) {
                    await welcomeSchema.findOneAndUpdate(
                        { guilId: interaction.guild.id },
                        {
                            channelId: channel.id,
                            WelcomeMessage: message,
                            WelcomeImage: image,
                            systemOptions: true
                        }
                    )

                    await systemMessage?.edit({ content: 'Sistema de bienvenida actualizado correctamente', components: [] });
                } else {
                    const newData = new welcomeSchema({
                        guilId: interaction.guild.id,
                        channelId: channel.id,
                        WelcomeMessage: message,
                        WelcomeImage: image,
                        systemOptions: true
                    });
                    await newData.save();

                    await systemMessage?.edit({ content: 'Sistema de bienvenida activado correctamente', components: [] });
                }
            } else {
                await systemMessage?.edit({ content: 'Sistema de bienvenida cancelado , ingresa de nuevo el comando', components: [] , embeds: [] });
            }
        } catch (error) {
            if (error instanceof TypeError && error.code == 'colorConvert') {
                return interaction.reply({ content: 'El color introducido no es válido', ephemeral: true });
            } else if (error instanceof TypeError && error.code == 'InteractionCollectorError') {
                return systemMessage?.edit({ content: 'El tiempo de espera ha expirado , ingresa de nuevo el comando', components: [] });
            } else return console.log(error);
        }

    }

}

