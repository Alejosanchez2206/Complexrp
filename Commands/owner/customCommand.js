const {
    SlashCommandBuilder,
    Client,
    PermissionFlagsBits,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ActionRowBuilder,
    EmbedBuilder
} = require('discord.js');
const config = require('../../config.json');
const customCommand = require('../../Models/customCommand');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('custom-command')
        .setDescription('Gestiona comandos personalizados del servidor')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(subcommand =>
            subcommand
                .setName('crear')
                .setDescription('Crea un nuevo comando personalizado')
                .addStringOption(option =>
                    option.setName('nombre')
                        .setDescription('Nombre del comando (sin / ni espacios)')
                        .setRequired(true)
                )
                .addStringOption(option =>
                    option.setName('tipo')
                        .setDescription('Tipo de respuesta del comando')
                        .setRequired(true)
                        .addChoices(
                            { name: '📝 Texto Simple', value: 'texto' },
                            { name: '📋 Embed', value: 'embed' }
                        )
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('editar')
                .setDescription('Edita un comando personalizado existente')
                .addStringOption(option =>
                    option.setName('nombre')
                        .setDescription('Nombre del comando a editar')
                        .setRequired(true)
                        .setAutocomplete(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('eliminar')
                .setDescription('Elimina un comando personalizado')
                .addStringOption(option =>
                    option.setName('nombre')
                        .setDescription('Nombre del comando a eliminar')
                        .setRequired(true)
                        .setAutocomplete(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('listar')
                .setDescription('Lista todos los comandos personalizados del servidor')
        ),

    /**
     * @param {import('discord.js').ChatInputCommandInteraction} interaction
     * @param {Client} client 
     */
    async execute(interaction, client) {
        try {
            // VALIDACIÓN ESTRICTA: Solo Administradores
            const isOwner = Array.isArray(config.Owners) 
                ? config.Owners.includes(interaction.user.id)
                : config.Owners === interaction.user.id;

            const isAdmin = interaction.member.permissions.has(PermissionFlagsBits.Administrator);

            if (!isOwner && !isAdmin) {
                const embed = new EmbedBuilder()
                    .setColor('#ff0000')
                    .setTitle('🔒 Acceso Denegado')
                    .setDescription('No tienes permisos para usar este comando.')
                    .addFields({
                        name: '⚠️ Permisos Requeridos',
                        value: '• **Administrador** del servidor\n• O ser **propietario** del bot',
                        inline: false
                    })
                    .setFooter({
                        text: 'Este comando está restringido a administradores',
                        iconURL: interaction.guild.iconURL()
                    })
                    .setTimestamp();

                return interaction.reply({
                    embeds: [embed],
                    ephemeral: true
                });
            }

            const subcommand = interaction.options.getSubcommand();

            switch (subcommand) {
                case 'crear':
                    await handleCrear(interaction);
                    break;
                case 'editar':
                    await handleEditar(interaction);
                    break;
                case 'eliminar':
                    await handleEliminar(interaction);
                    break;
                case 'listar':
                    await handleListar(interaction);
                    break;
            }

        } catch (error) {
            console.error('Error en custom-command:', error);
            
            const errorEmbed = new EmbedBuilder()
                .setColor('#ff0000')
                .setTitle('❌ Error')
                .setDescription('Ocurrió un error al ejecutar el comando.')
                .addFields({
                    name: 'Detalles',
                    value: `\`${error.message}\``,
                    inline: false
                })
                .setTimestamp();

            const errorMessage = {
                embeds: [errorEmbed],
                ephemeral: true
            };

            if (interaction.replied || interaction.deferred) {
                await interaction.editReply(errorMessage);
            } else {
                await interaction.reply(errorMessage);
            }
        }
    }
};

/**
 * Maneja la creación de un comando personalizado
 */
async function handleCrear(interaction) {
    const commandName = interaction.options.getString('nombre').toLowerCase().trim();
    const tipo = interaction.options.getString('tipo');

    // Validar nombre del comando
    if (!/^[a-z0-9_-]+$/.test(commandName)) {
        return interaction.reply({
            content: '❌ El nombre del comando solo puede contener letras minúsculas, números, guiones y guiones bajos.',
            ephemeral: true
        });
    }

    // Validar longitud del nombre
    if (commandName.length < 2 || commandName.length > 32) {
        return interaction.reply({
            content: '❌ El nombre del comando debe tener entre 2 y 32 caracteres.',
            ephemeral: true
        });
    }

    // Verificar si ya existe
    const existingCommand = await customCommand.findOne({
        guildId: interaction.guild.id,
        commandName: commandName
    });

    if (existingCommand) {
        return interaction.reply({
            content: `❌ Ya existe un comando llamado \`${commandName}\`. Usa \`/custom-command editar\` para modificarlo.`,
            ephemeral: true
        });
    }

    // Crear modal según el tipo
    if (tipo === 'texto') {
        await showModalTexto(interaction, commandName, 'crear');
    } else {
        await showModalEmbed(interaction, commandName, 'crear');
    }
}

/**
 * Maneja la edición de un comando personalizado
 */
async function handleEditar(interaction) {
    const commandName = interaction.options.getString('nombre').toLowerCase().trim();

    // Buscar el comando
    const existingCommand = await customCommand.findOne({
        guildId: interaction.guild.id,
        commandName: commandName
    });

    if (!existingCommand) {
        return interaction.reply({
            content: `❌ No existe un comando llamado \`${commandName}\`.`,
            ephemeral: true
        });
    }

    // Mostrar modal según el tipo
    if (existingCommand.tipo === 'texto') {
        await showModalTexto(interaction, commandName, 'editar', existingCommand);
    } else {
        await showModalEmbed(interaction, commandName, 'editar', existingCommand);
    }
}

/**
 * Maneja la eliminación de un comando personalizado
 */
async function handleEliminar(interaction) {
    const commandName = interaction.options.getString('nombre').toLowerCase().trim();

    const result = await customCommand.findOneAndDelete({
        guildId: interaction.guild.id,
        commandName: commandName
    });

    if (!result) {
        return interaction.reply({
            content: `❌ No existe un comando llamado \`${commandName}\`.`,
            ephemeral: true
        });
    }

    const embed = new EmbedBuilder()
        .setColor('#ff0000')
        .setTitle('🗑️ Comando Eliminado')
        .setDescription(`El comando \`${commandName}\` ha sido eliminado exitosamente.`)
        .addFields(
            {
                name: 'Tipo',
                value: result.tipo === 'texto' ? '📝 Texto Simple' : '📋 Embed',
                inline: true
            },
            {
                name: 'Comando',
                value: `\`${commandName}\``,
                inline: true
            }
        )
        .setFooter({
            text: `Eliminado por ${interaction.user.tag}`,
            iconURL: interaction.user.displayAvatarURL()
        })
        .setTimestamp();

    await interaction.reply({ embeds: [embed], ephemeral: true });
    console.log(`🗑️ Comando eliminado: ${commandName} por ${interaction.user.tag}`);
}

/**
 * Maneja el listado de comandos personalizados
 */
async function handleListar(interaction) {
    const commands = await customCommand.find({
        guildId: interaction.guild.id
    }).sort({ commandName: 1 });

    if (commands.length === 0) {
        const embed = new EmbedBuilder()
            .setColor('#ffa500')
            .setTitle('📝 Sin Comandos Personalizados')
            .setDescription('No hay comandos personalizados en este servidor.')
            .addFields({
                name: '💡 ¿Cómo crear uno?',
                value: 'Usa `/custom-command crear` para crear tu primer comando personalizado.',
                inline: false
            })
            .setFooter({
                text: `Servidor: ${interaction.guild.name}`,
                iconURL: interaction.guild.iconURL()
            })
            .setTimestamp();

        return interaction.reply({
            embeds: [embed],
            ephemeral: true
        });
    }

    const embed = new EmbedBuilder()
        .setColor('#0099ff')
        .setTitle('📚 Comandos Personalizados del Servidor')
        .setDescription(`Total: **${commands.length}** comando(s)\nPrefix: \`${config.PREFIX}\``)
        .setThumbnail(interaction.guild.iconURL({ size: 256 }))
        .setTimestamp();

    // Agrupar por tipo
    const textCommands = commands.filter(c => c.tipo === 'texto');
    const embedCommands = commands.filter(c => c.tipo === 'embed');

    if (textCommands.length > 0) {
        const textList = textCommands
            .map(c => `• \`${config.PREFIX}${c.commandName}\``)
            .join('\n');
        
        embed.addFields({
            name: `📝 Comandos de Texto (${textCommands.length})`,
            value: textList.length > 1024 ? textList.slice(0, 1021) + '...' : textList,
            inline: false
        });
    }

    if (embedCommands.length > 0) {
        const embedList = embedCommands
            .map(c => `• \`${config.PREFIX}${c.commandName}\``)
            .join('\n');
        
        embed.addFields({
            name: `📋 Comandos con Embed (${embedCommands.length})`,
            value: embedList.length > 1024 ? embedList.slice(0, 1021) + '...' : embedList,
            inline: false
        });
    }

    embed.addFields({
        name: 'ℹ️ Información',
        value: '• Usa `/custom-command editar` para modificar un comando\n' +
               '• Usa `/custom-command eliminar` para borrar un comando',
        inline: false
    });

    embed.setFooter({
        text: `Solicitado por ${interaction.user.tag}`,
        iconURL: interaction.user.displayAvatarURL()
    });

    await interaction.reply({ embeds: [embed], ephemeral: true });
}

/**
 * Muestra modal para comando de texto
 */
async function showModalTexto(interaction, commandName, accion, existingCommand = null) {
    const modal = new ModalBuilder()
        .setCustomId(`custom_command_texto_${accion}_${commandName}`)
        .setTitle(`${accion === 'crear' ? 'Crear' : 'Editar'} Comando: ${commandName}`);

    const responseInput = new TextInputBuilder()
        .setCustomId('response')
        .setLabel('Respuesta del Comando')
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder('Escribe la respuesta que dará el comando...\n\nVariables disponibles:\n{user}, {username}, {server}, {channel}, etc.')
        .setRequired(true)
        .setMinLength(1)
        .setMaxLength(2000);

    if (existingCommand?.response) {
        responseInput.setValue(existingCommand.response);
    }

    const row = new ActionRowBuilder().addComponents(responseInput);
    modal.addComponents(row);

    await interaction.showModal(modal);
}

/**
 * Muestra modal para comando de embed
 */
async function showModalEmbed(interaction, commandName, accion, existingCommand = null) {
    const modal = new ModalBuilder()
        .setCustomId(`custom_command_embed_${accion}_${commandName}`)
        .setTitle(`${accion === 'crear' ? 'Crear' : 'Editar'} Embed: ${commandName}`);

    const titleInput = new TextInputBuilder()
        .setCustomId('title')
        .setLabel('Título del Embed (Opcional)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Título del embed...')
        .setRequired(false)
        .setMaxLength(256);

    const descriptionInput = new TextInputBuilder()
        .setCustomId('description')
        .setLabel('Descripción del Embed')
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder('Descripción del embed...\n\nPuedes usar variables como {user}, {server}, etc.')
        .setRequired(true)
        .setMinLength(1)
        .setMaxLength(4000);

    const colorInput = new TextInputBuilder()
        .setCustomId('color')
        .setLabel('Color del Embed (Formato: #RRGGBB)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('#0099ff')
        .setRequired(false)
        .setMinLength(7)
        .setMaxLength(7)
        .setValue(existingCommand?.embedData?.color || '#0099ff');

    const footerInput = new TextInputBuilder()
        .setCustomId('footer')
        .setLabel('Footer del Embed (Opcional)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Texto del footer...')
        .setRequired(false)
        .setMaxLength(2048);

    const imageInput = new TextInputBuilder()
        .setCustomId('image')
        .setLabel('URL de Imagen (Opcional)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('https://ejemplo.com/imagen.png')
        .setRequired(false)
        .setMaxLength(500);

    if (existingCommand?.embedData) {
        if (existingCommand.embedData.title) titleInput.setValue(existingCommand.embedData.title);
        if (existingCommand.embedData.description) descriptionInput.setValue(existingCommand.embedData.description);
        if (existingCommand.embedData.footer) footerInput.setValue(existingCommand.embedData.footer);
        if (existingCommand.embedData.image) imageInput.setValue(existingCommand.embedData.image);
    }

    const row1 = new ActionRowBuilder().addComponents(titleInput);
    const row2 = new ActionRowBuilder().addComponents(descriptionInput);
    const row3 = new ActionRowBuilder().addComponents(colorInput);
    const row4 = new ActionRowBuilder().addComponents(footerInput);
    const row5 = new ActionRowBuilder().addComponents(imageInput);

    modal.addComponents(row1, row2, row3, row4, row5);

    await interaction.showModal(modal);
}