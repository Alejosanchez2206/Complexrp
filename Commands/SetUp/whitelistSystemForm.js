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

const permisosSchema = require('../../Models/addPermisos');

const whitelistSchema = require('../../Models/whitelistSystemSchema');

// Verificar la versión de discord.js y usar el estilo apropiado
const ButtonStylePrimary = ButtonStyle?.Primary ?? 1;
const ButtonStyleDanger = ButtonStyle?.Danger ?? 4;
const ButtonStyleSuccess = ButtonStyle?.Success ?? 3;

const buttons = new ActionRowBuilder()
    .addComponents(
        new ButtonBuilder()
            .setCustomId('WhitelistSystemSubmit')
            .setStyle(ButtonStylePrimary)
            .setEmoji('✅')
            .setLabel('Activar'),

        new ButtonBuilder()
            .setCustomId('WhitelistSystemDeclime')
            .setStyle(ButtonStyleDanger)
            .setEmoji('❌')
            .setLabel('Desactivar'),
    );


const urlImgRegex = /(https?:\/\/.*\.(?:png|jpg|gif|webp))/i;
const colorRegex = /^#([0-9a-f]{3}){1,2}$/i;

module.exports = {
    data: new SlashCommandBuilder()
        .setName('whitelist-system')
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
            option.setName('channelresult')
                .setDescription('Canal donde se envia el resultado')
        ).addChannelOption(option =>
            option.setName('channellog')
                .setDescription('Canal donde se envia el log')
        )
    ,

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
                        .setCustomId('whitelistSystem')
                        .setStyle(ButtonStyleSuccess)
                        .setLabel('Realizar Whitelist'),
                )

            // Diferimos la respuesta para poder editarla después
            await interaction.deferReply({ ephemeral: true });

            //Verificar que rol tiene el usuario 
            const rolesUser = interaction.member.roles.cache.map(role => role.id).join(',');
            const rolesArray = rolesUser.split(',');
            const validarRol = await permisosSchema.find({ permiso: 'whitelist', guild: interaction.guild.id, rol: { $in: rolesArray } });

            if (validarRol.length === 0) {
                return interaction.editReply({ content: 'No tienes permisos para usar este comando', ephemeral: true });
            }

            let systemMessage;
            const message = interaction.options.getString('message').replace(/\\n/g, '\n').substring(0, 2000);
            const imageOption = interaction.options.getString('image');
            const image = imageOption && urlImgRegex.test(imageOption) ? imageOption : interaction.guild.iconURL();
            const colorOption = interaction.options.getString('color');
            const color = colorOption && colorRegex.test(colorOption) ? colorOption : '#000000';
            const channel = interaction.options.getChannel('channel');
            const role = interaction.options.getRole('role');
            const channelresult = interaction.options.getChannel('channelresult');
            const channelseend = interaction.options.getChannel('channellog');

            const data = await whitelistSchema.findOne({ guildId: interaction.guild.id });

            if (data) {
                await whitelistSchema.findOneAndDelete({ guildId: interaction.guild.id });
            }

            const embed = new EmbedBuilder()
                .setDescription(message)
                .setColor(color)
                .setImage(image);

            systemMessage = await interaction.editReply({
                content: 'Preview del sistema de anuncios\nEn caso de ser correcto presione el botón de aceptar',
                embeds: [embed],
                components: [buttons],
                ephemeral: true
            });

            const confirmation = await systemMessage.awaitMessageComponent({
                filter: i => i.user.id === interaction.user.id,
                time: 30000,
                componentType: ComponentType.Button
            });

            if (confirmation.customId === 'WhitelistSystemSubmit') {
                // Enviar el mensaje al canal especificado
                await interaction.guild.channels.cache.get(channel.id).send({
                    embeds: [embed],
                    components: [button]
                });

                // Crear la entrada en la base de datos
                await whitelistSchema.create({
                    guildId: interaction.guild.id,
                    channelId: channel.id,
                    roleId: role?.id || null,
                    channelResult: channelresult?.id || null,
                    channelSend: channelseend?.id || null
                });

                // Responder al componente y editar el mensaje original
                await confirmation.update({
                    content: 'Sistema enviado con éxito',
                    embeds: [],
                    components: []
                });

            } else if (confirmation.customId === 'WhitelistSystemDeclime') {
                // Responder al componente y editar el mensaje original
                await confirmation.update({
                    content: 'Sistema desactivado con éxito',
                    embeds: [],
                    components: []
                });
            }

        } catch (error) {
            console.log(error);
            
            // Verificar si la interacción ya fue respondida o diferida
            if (interaction.deferred && !interaction.replied) {
                // Si fue diferida pero no respondida, usar editReply
                try {
                    await interaction.editReply({ 
                        content: `Ocurrió un error al ejecutar el comando ${interaction.commandName}`, 
                        ephemeral: true 
                    });
                } catch (editError) {
                    console.log('Error al editar la respuesta:', editError);
                }
            } else if (!interaction.replied) {
                // Si no fue respondida, usar reply
                try {
                    await interaction.reply({ 
                        content: `Ocurrió un error al ejecutar el comando ${interaction.commandName}`, 
                        ephemeral: true 
                    });
                } catch (replyError) {
                    console.log('Error al responder:', replyError);
                }
            }
        }
    }
}