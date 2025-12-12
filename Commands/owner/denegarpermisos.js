const {
    SlashCommandBuilder,
    Client,
    PermissionFlagsBits,
    ChatInputCommandInteraction,
    ChannelType,
    EmbedBuilder
} = require('discord.js');

const permisosEspecialSchema = require('../../Models/permisosEspecial');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('manage-role-permissions')
        .setDescription('Gestiona los permisos de un rol en canales del servidor')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        // OPCIONES REQUERIDAS PRIMERO
        .addRoleOption(option =>
            option.setName('rol')
                .setDescription('Rol al que se aplicarán los cambios')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('accion')
                .setDescription('Acción a realizar')
                .setRequired(true)
                .addChoices(
                    { name: '🔒 Denegar todos los permisos', value: 'deny_all' },
                    { name: '👁️ Solo ocultar canales', value: 'hide_only' },
                    { name: '💬 Solo denegar escritura', value: 'deny_write' },
                    { name: '✅ Permitir todos los permisos', value: 'allow_all' },
                    { name: '👁️✅ Solo permitir ver canales', value: 'allow_view' },
                    { name: '💬✅ Solo permitir escritura', value: 'allow_write' },
                    { name: '🔓 Restaurar permisos (restablecer)', value: 'restore' }
                )
        )
        .addBooleanOption(option =>
            option.setName('confirmar')
                .setDescription('⚠️ Confirmar que entiendes los riesgos de esta acción')
                .setRequired(true)
        )
        // OPCIONES NO REQUERIDAS DESPUÉS
        .addStringOption(option =>
            option.setName('tipo')
                .setDescription('Tipo de canales a afectar')
                .setRequired(false)
                .addChoices(
                    { name: '📝 Todos los canales', value: 'all' },
                    { name: '💬 Solo canales de texto', value: 'text' },
                    { name: '🔊 Solo canales de voz', value: 'voice' },
                    { name: '📁 Solo categorías', value: 'category' },
                    { name: '🎭 Solo foros', value: 'forum' },
                    { name: '📢 Solo anuncios', value: 'announcement' }
                )
        )
        .addChannelOption(option =>
            option.setName('excluir')
                .setDescription('Canal a excluir de los cambios (opcional)')
                .setRequired(false)
        )
        .addBooleanOption(option =>
            option.setName('incluir_categorias')
                .setDescription('¿Aplicar también a las categorías? (afecta permisos heredados)')
                .setRequired(false)
        ),

    /**
     * @param {ChatInputCommandInteraction} interaction
     * @param {Client} client
     * @returns {Promise<void>}
     */
    async execute(interaction, client) {
        try {
            // Validaciones iniciales
            if (!interaction.guild) {
                return interaction.reply({
                    content: '❌ Este comando solo puede usarse en servidores.',
                    ephemeral: true
                });
            }

            if (!interaction.isChatInputCommand()) return;

            // Validar permisos especiales
            const validarEspecial = await permisosEspecialSchema.findOne({
                guildServidor: interaction.guild.id,
                guildUsuario: interaction.user.id
            });

            if (!validarEspecial) {
                return interaction.reply({
                    content: '❌ No tienes permisos especiales para usar este comando.',
                    ephemeral: true
                });
            }

            // Verificar confirmación
            const confirmar = interaction.options.getBoolean('confirmar');
            if (!confirmar) {
                return interaction.reply({
                    content: '⚠️ Debes confirmar que entiendes los riesgos de esta acción marcando la opción de confirmación.',
                    ephemeral: true
                });
            }

            // Obtener el rol
            const targetRole = interaction.options.getRole('rol');
            
            // Validar que no sea @everyone (ya que tiene un comportamiento especial)
            if (targetRole.id === interaction.guild.id) {
                return interaction.reply({
                    content: '⚠️ Para modificar el rol @everyone, usa este comando con precaución ya que afecta a todos los miembros sin roles.',
                    ephemeral: true
                });
            }

            // Verificar jerarquía de roles
            const botMember = interaction.guild.members.me;
            const botHighestRole = botMember.roles.highest;
            
            if (targetRole.position >= botHighestRole.position) {
                return interaction.reply({
                    content: `❌ No puedo modificar el rol **${targetRole.name}** porque está en una posición igual o superior a mi rol más alto.`,
                    ephemeral: true
                });
            }

            // Verificar jerarquía del usuario
            const userMember = interaction.member;
            const userHighestRole = userMember.roles.highest;
            
            if (targetRole.position >= userHighestRole.position && interaction.guild.ownerId !== interaction.user.id) {
                return interaction.reply({
                    content: `❌ No puedes modificar el rol **${targetRole.name}** porque está en una posición igual o superior a tu rol más alto.`,
                    ephemeral: true
                });
            }

            // Verificar permisos del bot
            if (!botMember.permissions.has(PermissionFlagsBits.ManageRoles) ||
                !botMember.permissions.has(PermissionFlagsBits.ManageChannels)) {
                return interaction.reply({
                    content: '❌ No tengo permisos suficientes (Gestionar Roles y Gestionar Canales) para ejecutar este comando.',
                    ephemeral: true
                });
            }

            await interaction.deferReply({ ephemeral: true });

            // Obtener opciones
            const accion = interaction.options.getString('accion');
            const tipo = interaction.options.getString('tipo') || 'all';
            const canalExcluir = interaction.options.getChannel('excluir');
            const incluirCategorias = interaction.options.getBoolean('incluir_categorias') ?? true;

            let channelsToProcess = interaction.guild.channels.cache;

            // Filtrar por tipo de canal
            channelsToProcess = channelsToProcess.filter(channel => {
                // Excluir canal específico si se proporcionó
                if (canalExcluir && channel.id === canalExcluir.id) return false;

                // Filtrar categorías si no se deben incluir
                if (!incluirCategorias && channel.type === ChannelType.GuildCategory) return false;

                switch (tipo) {
                    case 'text':
                        return channel.type === ChannelType.GuildText;
                    case 'voice':
                        return channel.type === ChannelType.GuildVoice;
                    case 'category':
                        return channel.type === ChannelType.GuildCategory;
                    case 'forum':
                        return channel.type === ChannelType.GuildForum;
                    case 'announcement':
                        return channel.type === ChannelType.GuildAnnouncement;
                    case 'all':
                    default:
                        return true;
                }
            });

            // Obtener permisos según la acción
            const getPermissions = (action) => {
                switch (action) {
                    case 'deny_all':
                        return {
                            ViewChannel: false,
                            SendMessages: false,
                            SendMessagesInThreads: false,
                            CreatePublicThreads: false,
                            CreatePrivateThreads: false,
                            EmbedLinks: false,
                            AttachFiles: false,
                            AddReactions: false,
                            UseExternalEmojis: false,
                            UseExternalStickers: false,
                            MentionEveryone: false,
                            ManageMessages: false,
                            ManageThreads: false,
                            ReadMessageHistory: false,
                            SendTTSMessages: false,
                            SendVoiceMessages: false,
                            Connect: false,
                            Speak: false,
                            Stream: false,
                            UseEmbeddedActivities: false,
                            UseSoundboard: false,
                            UseExternalSounds: false,
                            UseVAD: false
                        };
                    case 'hide_only':
                        return {
                            ViewChannel: false
                        };
                    case 'deny_write':
                        return {
                            SendMessages: false,
                            SendMessagesInThreads: false,
                            CreatePublicThreads: false,
                            CreatePrivateThreads: false,
                            AddReactions: false,
                            Speak: false
                        };
                    case 'allow_all':
                        return {
                            ViewChannel: true,
                            SendMessages: true,
                            SendMessagesInThreads: true,
                            CreatePublicThreads: true,
                            CreatePrivateThreads: true,
                            EmbedLinks: true,
                            AttachFiles: true,
                            AddReactions: true,
                            UseExternalEmojis: true,
                            UseExternalStickers: true,
                            ReadMessageHistory: true,
                            SendVoiceMessages: true,
                            Connect: true,
                            Speak: true,
                            Stream: true,
                            UseEmbeddedActivities: true,
                            UseSoundboard: true,
                            UseExternalSounds: true,
                            UseVAD: true
                        };
                    case 'allow_view':
                        return {
                            ViewChannel: true,
                            ReadMessageHistory: true
                        };
                    case 'allow_write':
                        return {
                            SendMessages: true,
                            SendMessagesInThreads: true,
                            AddReactions: true,
                            EmbedLinks: true,
                            AttachFiles: true,
                            Speak: true
                        };
                    case 'restore':
                        return {
                            ViewChannel: null,
                            SendMessages: null,
                            SendMessagesInThreads: null,
                            CreatePublicThreads: null,
                            CreatePrivateThreads: null,
                            EmbedLinks: null,
                            AttachFiles: null,
                            AddReactions: null,
                            UseExternalEmojis: null,
                            UseExternalStickers: null,
                            MentionEveryone: null,
                            ManageMessages: null,
                            ManageThreads: null,
                            ReadMessageHistory: null,
                            SendTTSMessages: null,
                            SendVoiceMessages: null,
                            Connect: null,
                            Speak: null,
                            Stream: null,
                            UseEmbeddedActivities: null,
                            UseSoundboard: null,
                            UseExternalSounds: null,
                            UseVAD: null
                        };
                    default:
                        return {};
                }
            };

            const permissions = getPermissions(accion);
            let updatedChannels = 0;
            let skippedChannels = 0;
            const errors = [];
            const channelTypes = {
                text: 0,
                voice: 0,
                category: 0,
                forum: 0,
                announcement: 0,
                other: 0
            };

            // Procesar canales
            for (const channel of channelsToProcess.values()) {
                try {
                    // Verificar que el bot tenga permisos en este canal
                    if (!channel.permissionsFor(botMember)?.has(PermissionFlagsBits.ManageRoles)) {
                        skippedChannels++;
                        errors.push(`❌ ${channel.name}: Sin permisos suficientes`);
                        continue;
                    }

                    await channel.permissionOverwrites.edit(targetRole, permissions);
                    updatedChannels++;

                    // Contar por tipo
                    switch (channel.type) {
                        case ChannelType.GuildText:
                            channelTypes.text++;
                            break;
                        case ChannelType.GuildVoice:
                            channelTypes.voice++;
                            break;
                        case ChannelType.GuildCategory:
                            channelTypes.category++;
                            break;
                        case ChannelType.GuildForum:
                            channelTypes.forum++;
                            break;
                        case ChannelType.GuildAnnouncement:
                            channelTypes.announcement++;
                            break;
                        default:
                            channelTypes.other++;
                    }

                    // Actualizar progreso cada 10 canales
                    if (updatedChannels % 10 === 0) {
                        await interaction.editReply({
                            content: `🔄 Procesando... ${updatedChannels} canales actualizados para el rol **${targetRole.name}**.`,
                            ephemeral: true
                        });
                    }

                    // Pequeño delay para evitar rate limits
                    await new Promise(resolve => setTimeout(resolve, 100));

                } catch (channelError) {
                    console.error(`Error al actualizar permisos en el canal ${channel.name}:`, channelError);
                    errors.push(`❌ ${channel.name}: ${channelError.message}`);
                    skippedChannels++;
                    continue;
                }
            }

            // Crear embed de respuesta
            const embed = new EmbedBuilder()
                .setColor(getActionColor(accion))
                .setTitle('🔐 Permisos de Rol Actualizados')
                .setDescription(getActionDescription(accion, targetRole.name))
                .addFields(
                    {
                        name: '🎭 Rol Modificado',
                        value: `${targetRole}`,
                        inline: true
                    },
                    {
                        name: '✅ Canales Actualizados',
                        value: `**${updatedChannels}** canales`,
                        inline: true
                    },
                    {
                        name: '⏭️ Canales Omitidos',
                        value: `**${skippedChannels}** canales`,
                        inline: true
                    },
                    {
                        name: '📊 Total Procesados',
                        value: `**${channelsToProcess.size}** canales`,
                        inline: true
                    },
                    {
                        name: '⚙️ Acción Realizada',
                        value: `\`${accion}\``,
                        inline: true
                    },
                    {
                        name: '📁 Tipo de Canales',
                        value: getTipoLabel(tipo),
                        inline: true
                    }
                )
                .setFooter({
                    text: `Ejecutado por ${interaction.user.tag}`,
                    iconURL: interaction.user.displayAvatarURL()
                })
                .setTimestamp();

            // Agregar desglose por tipo si es relevante
            if (updatedChannels > 0) {
                let breakdown = '';
                if (channelTypes.text > 0) breakdown += `💬 Texto: ${channelTypes.text}\n`;
                if (channelTypes.voice > 0) breakdown += `🔊 Voz: ${channelTypes.voice}\n`;
                if (channelTypes.category > 0) breakdown += `📁 Categorías: ${channelTypes.category}\n`;
                if (channelTypes.forum > 0) breakdown += `🎭 Foros: ${channelTypes.forum}\n`;
                if (channelTypes.announcement > 0) breakdown += `📢 Anuncios: ${channelTypes.announcement}\n`;
                if (channelTypes.other > 0) breakdown += `📌 Otros: ${channelTypes.other}\n`;

                if (breakdown) {
                    embed.addFields({
                        name: '📋 Desglose por Tipo',
                        value: breakdown,
                        inline: false
                    });
                }
            }

            // Agregar advertencias o errores
            if (errors.length > 0) {
                const errorText = errors.slice(0, 5).join('\n');
                const moreErrors = errors.length > 5 ? `\n... y ${errors.length - 5} errores más` : '';
                embed.addFields({
                    name: '⚠️ Advertencias/Errores',
                    value: errorText + moreErrors,
                    inline: false
                });
            }

            if (canalExcluir) {
                embed.addFields({
                    name: '🛡️ Canal Excluido',
                    value: `${canalExcluir}`,
                    inline: false
                });
            }

            // Agregar nota sobre categorías si aplica
            if (!incluirCategorias && tipo === 'all') {
                embed.addFields({
                    name: 'ℹ️ Nota',
                    value: 'Las categorías no fueron modificadas. Los canales heredarán los permisos de sus categorías padre.',
                    inline: false
                });
            }

            await interaction.editReply({
                embeds: [embed],
                ephemeral: true
            });

        } catch (error) {
            console.error('Error al ejecutar el comando manage-role-permissions:', error);

            const errorEmbed = new EmbedBuilder()
                .setColor('#ff0000')
                .setTitle('❌ Error en la Operación')
                .setDescription('Ocurrió un error al ejecutar el comando. Por favor, intenta de nuevo.')
                .addFields({
                    name: 'Detalles del Error',
                    value: `\`${error.message}\``,
                    inline: false
                })
                .setTimestamp();

            if (interaction.deferred || interaction.replied) {
                await interaction.editReply({
                    embeds: [errorEmbed],
                    ephemeral: true
                });
            } else {
                await interaction.reply({
                    embeds: [errorEmbed],
                    ephemeral: true
                });
            }
        }
    }
};

/**
 * Obtiene la descripción de la acción realizada
 * @param {string} action - La acción realizada
 * @param {string} roleName - Nombre del rol
 * @returns {string} Descripción de la acción
 */
function getActionDescription(action, roleName) {
    switch (action) {
        case 'deny_all':
            return `🔒 Se han **denegado todos los permisos** al rol **${roleName}** en los canales seleccionados.`;
        case 'hide_only':
            return `👁️ Se ha **ocultado la visibilidad** de los canales seleccionados para el rol **${roleName}**.`;
        case 'deny_write':
            return `💬 Se han **denegado los permisos de escritura** en los canales seleccionados para el rol **${roleName}**.`;
        case 'allow_all':
            return `✅ Se han **permitido todos los permisos** al rol **${roleName}** en los canales seleccionados.`;
        case 'allow_view':
            return `👁️✅ Se han **permitido permisos de visualización** al rol **${roleName}** en los canales seleccionados.`;
        case 'allow_write':
            return `💬✅ Se han **permitido permisos de escritura** al rol **${roleName}** en los canales seleccionados.`;
        case 'restore':
            return `🔓 Se han **restaurado los permisos** (eliminado overrides) del rol **${roleName}** en los canales seleccionados.`;
        default:
            return 'Operación completada.';
    }
}

/**
 * Obtiene el color del embed según la acción
 * @param {string} action - La acción realizada
 * @returns {string} Color en hexadecimal
 */
function getActionColor(action) {
    switch (action) {
        case 'deny_all':
        case 'hide_only':
        case 'deny_write':
            return '#ff6b6b'; // Rojo
        case 'allow_all':
        case 'allow_view':
        case 'allow_write':
            return '#51cf66'; // Verde
        case 'restore':
            return '#4dabf7'; // Azul
        default:
            return '#868e96'; // Gris
    }
}

/**
 * Obtiene la etiqueta del tipo de canal
 * @param {string} tipo - Tipo de canal
 * @returns {string} Etiqueta formateada
 */
function getTipoLabel(tipo) {
    switch (tipo) {
        case 'text':
            return '💬 Solo Texto';
        case 'voice':
            return '🔊 Solo Voz';
        case 'category':
            return '📁 Solo Categorías';
        case 'forum':
            return '🎭 Solo Foros';
        case 'announcement':
            return '📢 Solo Anuncios';
        case 'all':
        default:
            return '📝 Todos';
    }
}