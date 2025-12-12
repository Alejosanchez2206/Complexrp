const {
    SlashCommandBuilder,
    Client,
    PermissionFlagsBits,
    ButtonBuilder,
    ButtonStyle,
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
        // Verificar que sea un comando de chat y no autocomplete
        if (!interaction.isChatInputCommand()) return;

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
            console.error('Stack:', error.stack);
            
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

            try {
                if (interaction.replied || interaction.deferred) {
                    await interaction.editReply(errorMessage).catch(() => {});
                } else if (interaction.isRepliable()) {
                    await interaction.reply(errorMessage).catch(() => {});
                }
            } catch (replyError) {
                console.error('Error al responder:', replyError);
            }
        }
    }
};

/**
 * Maneja la creación de un comando personalizado
 */
async function handleCrear(interaction) {
    try {
        const commandName = interaction.options.getString('nombre').toLowerCase().trim();
        const tipo = interaction.options.getString('tipo');

        // Validar nombre del comando ANTES de defer
        if (!/^[a-z0-9_-]+$/.test(commandName)) {
            return interaction.reply({
                content: '❌ El nombre del comando solo puede contener letras minúsculas, números, guiones y guiones bajos.',
                ephemeral: true
            });
        }

        if (commandName.length < 2 || commandName.length > 32) {
            return interaction.reply({
                content: '❌ El nombre del comando debe tener entre 2 y 32 caracteres.',
                ephemeral: true
            });
        }

        // Ahora sí, defer para consultar DB
        await interaction.deferReply({ ephemeral: true });

        // Verificar si ya existe
        const existingCommand = await customCommand.findOne({
            guildId: interaction.guild.id,
            commandName: commandName
        });

        if (existingCommand) {
            return interaction.editReply({
                content: `❌ Ya existe un comando llamado \`${commandName}\`. Usa \`/custom-command editar\` para modificarlo.`
            });
        }

        // Informar que el comando está disponible y cómo crear el contenido
        const infoEmbed = new EmbedBuilder()
            .setColor('#00ff00')
            .setTitle('✅ Comando Disponible')
            .setDescription(`El nombre \`${commandName}\` está disponible para crear un comando.`)
            .addFields(
                {
                    name: '📝 Tipo Seleccionado',
                    value: tipo === 'texto' ? '📝 Texto Simple' : '📋 Embed',
                    inline: true
                },
                {
                    name: '🔗 Comando Final',
                    value: `\`${config.PREFIX}${commandName}\``,
                    inline: true
                },
                {
                    name: '📋 Siguiente Paso',
                    value: `Haz clic en el botón de abajo para crear el contenido.`,
                    inline: false
                }
            )
            .setFooter({
                text: `ID: ${commandName}_${tipo}`,
                iconURL: interaction.user.displayAvatarURL()
            })
            .setTimestamp();

        // Crear botón para abrir modal
        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`create_modal_${tipo}_${commandName}`)
                    .setLabel('Crear Contenido')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('📝')
            );

        await interaction.editReply({
            embeds: [infoEmbed],
            components: [row]
        });

    } catch (error) {
        console.error('Error en handleCrear:', error);
        
        try {
            const errorMsg = {
                content: `❌ Error: ${error.message}`,
                ephemeral: true
            };

            if (interaction.deferred || interaction.replied) {
                await interaction.editReply(errorMsg).catch(() => {});
            } else if (interaction.isRepliable()) {
                await interaction.reply(errorMsg).catch(() => {});
            }
        } catch (e) {
            console.error('Error al enviar mensaje de error:', e);
        }
    }
}

/**
 * Maneja la edición de un comando personalizado
 */
async function handleEditar(interaction) {
    try {
        await interaction.deferReply({ ephemeral: true });

        const commandName = interaction.options.getString('nombre').toLowerCase().trim();

        // Buscar el comando
        const existingCommand = await customCommand.findOne({
            guildId: interaction.guild.id,
            commandName: commandName
        });

        if (!existingCommand) {
            return interaction.editReply({
                content: `❌ No existe un comando llamado \`${commandName}\`.`
            });
        }

        // Informar y dar opción de editar con botón
        const infoEmbed = new EmbedBuilder()
            .setColor('#ffa500')
            .setTitle('✏️ Editar Comando')
            .setDescription(`Comando encontrado: \`${commandName}\``)
            .addFields(
                {
                    name: '📝 Tipo',
                    value: existingCommand.tipo === 'texto' ? '📝 Texto Simple' : '📋 Embed',
                    inline: true
                },
                {
                    name: '👤 Creado Por',
                    value: `<@${existingCommand.createdBy}>`,
                    inline: true
                },
                {
                    name: '📅 Última Actualización',
                    value: `<t:${Math.floor(existingCommand.updatedAt / 1000)}:R>`,
                    inline: true
                }
            )
            .setFooter({
                text: 'Usa el botón para editar el contenido',
                iconURL: interaction.user.displayAvatarURL()
            })
            .setTimestamp();

        // Crear botón para abrir modal de edición
        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`edit_modal_${existingCommand.tipo}_${commandName}`)
                    .setLabel('Editar Contenido')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('✏️')
            );

        await interaction.editReply({
            embeds: [infoEmbed],
            components: [row]
        });

    } catch (error) {
        console.error('Error en handleEditar:', error);
        
        try {
            const errorMsg = {
                content: `❌ Error: ${error.message}`,
                ephemeral: true
            };

            if (interaction.deferred || interaction.replied) {
                await interaction.editReply(errorMsg).catch(() => {});
            } else if (interaction.isRepliable()) {
                await interaction.reply(errorMsg).catch(() => {});
            }
        } catch (e) {
            console.error('Error al enviar mensaje de error:', e);
        }
    }
}

/**
 * Maneja la eliminación de un comando personalizado
 */
async function handleEliminar(interaction) {
    try {
        await interaction.deferReply({ ephemeral: true });

        const commandName = interaction.options.getString('nombre').toLowerCase().trim();

        const result = await customCommand.findOneAndDelete({
            guildId: interaction.guild.id,
            commandName: commandName
        });

        if (!result) {
            return interaction.editReply({
                content: `❌ No existe un comando llamado \`${commandName}\`.`
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
                    value: `\`${config.PREFIX}${commandName}\``,
                    inline: true
                }
            )
            .setFooter({
                text: `Eliminado por ${interaction.user.tag}`,
                iconURL: interaction.user.displayAvatarURL()
            })
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
        console.log(`🗑️ Comando eliminado: ${commandName} por ${interaction.user.tag}`);

    } catch (error) {
        console.error('Error en handleEliminar:', error);
        
        try {
            const errorMsg = {
                content: `❌ Error: ${error.message}`,
                ephemeral: true
            };

            if (interaction.deferred || interaction.replied) {
                await interaction.editReply(errorMsg).catch(() => {});
            } else if (interaction.isRepliable()) {
                await interaction.reply(errorMsg).catch(() => {});
            }
        } catch (e) {
            console.error('Error al enviar mensaje de error:', e);
        }
    }
}

/**
 * Maneja el listado de comandos personalizados
 */
async function handleListar(interaction) {
    try {
        await interaction.deferReply({ ephemeral: true });

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

            return interaction.editReply({ embeds: [embed] });
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

        await interaction.editReply({ embeds: [embed] });

    } catch (error) {
        console.error('Error en handleListar:', error);
        
        try {
            const errorMsg = {
                content: `❌ Error: ${error.message}`,
                ephemeral: true
            };

            if (interaction.deferred || interaction.replied) {
                await interaction.editReply(errorMsg).catch(() => {});
            } else if (interaction.isRepliable()) {
                await interaction.reply(errorMsg).catch(() => {});
            }
        } catch (e) {
            console.error('Error al enviar mensaje de error:', e);
        }
    }
}