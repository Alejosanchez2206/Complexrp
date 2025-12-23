const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    EmbedBuilder,
    ChannelType,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} = require('discord.js');

const streamAlertSchema = require('../../Models/streamAlertConfig');
const validarPermiso = require('../../utils/ValidarPermisos');

// ===== COLORES DE PLATAFORMAS =====
const PLATFORM_COLORS = {
    twitch: '#9146FF',      // Morado de Twitch
    kick: '#53FC18',        // Verde de Kick
    tiktok: '#000000'       // Negro de TikTok
};

// ===== EMOJIS DE PLATAFORMAS =====
const PLATFORM_EMOJIS = {
    twitch: '<:twitch:1234567890>',  // Reemplazar con emoji personalizado
    kick: '<:kick:1234567891>',      // Reemplazar con emoji personalizado
    tiktok: '<:tiktok:1234567892>'   // Reemplazar con emoji personalizado
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('streamalert')
        .setDescription('Sistema de alertas de streaming')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)

        // ===== SETUP INICIAL =====
        .addSubcommand(sub =>
            sub
                .setName('setup')
                .setDescription('Configura el sistema de alertas de stream')
                .addChannelOption(opt =>
                    opt
                        .setName('canal')
                        .setDescription('Canal donde se enviarán las alertas')
                        .setRequired(true)
                        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
                )
        )

        // ===== STREAMER: AGREGAR =====
        .addSubcommandGroup(group =>
            group
                .setName('streamer')
                .setDescription('Gestiona streamers')
                .addSubcommand(sub =>
                    sub
                        .setName('agregar')
                        .setDescription('Agrega un streamer para monitorear')
                        .addStringOption(opt =>
                            opt
                                .setName('plataforma')
                                .setDescription('Plataforma de streaming')
                                .setRequired(true)
                                .addChoices(
                                    { name: '🟣 Twitch', value: 'twitch' },
                                    { name: '🟢 Kick', value: 'kick' },
                                    { name: '⚫ TikTok', value: 'tiktok' }
                                )
                        )
                        .addStringOption(opt =>
                            opt
                                .setName('username')
                                .setDescription('Nombre de usuario del streamer')
                                .setRequired(true)
                        )
                        .addStringOption(opt =>
                            opt
                                .setName('nombre')
                                .setDescription('Nombre a mostrar (opcional)')
                                .setRequired(false)
                        )
                        .addRoleOption(opt =>
                            opt
                                .setName('rol')
                                .setDescription('Rol a mencionar cuando el stream inicie')
                                .setRequired(false)
                        )
                        .addStringOption(opt =>
                            opt
                                .setName('mensaje')
                                .setDescription('Mensaje personalizado (usa {streamer} para el nombre)')
                                .setRequired(false)
                        )
                )
                .addSubcommand(sub =>
                    sub
                        .setName('eliminar')
                        .setDescription('Elimina un streamer')
                        .addStringOption(opt =>
                            opt
                                .setName('id')
                                .setDescription('ID del streamer (usa /streamalert streamer listar)')
                                .setRequired(true)
                        )
                )
                .addSubcommand(sub =>
                    sub
                        .setName('listar')
                        .setDescription('Lista todos los streamers configurados')
                )
                .addSubcommand(sub =>
                    sub
                        .setName('editar')
                        .setDescription('Edita la configuración de un streamer')
                        .addStringOption(opt =>
                            opt
                                .setName('id')
                                .setDescription('ID del streamer')
                                .setRequired(true)
                        )
                )
                .addSubcommand(sub =>
                    sub
                        .setName('toggle')
                        .setDescription('Activa/desactiva un streamer')
                        .addStringOption(opt =>
                            opt
                                .setName('id')
                                .setDescription('ID del streamer')
                                .setRequired(true)
                        )
                )
        )

        // ===== KEYWORDS =====
        .addSubcommandGroup(group =>
            group
                .setName('keywords')
                .setDescription('Gestiona palabras clave')
                .addSubcommand(sub =>
                    sub
                        .setName('agregar')
                        .setDescription('Agrega una palabra clave global')
                        .addStringOption(opt =>
                            opt
                                .setName('palabra')
                                .setDescription('Palabra clave a buscar en títulos')
                                .setRequired(true)
                        )
                )
                .addSubcommand(sub =>
                    sub
                        .setName('eliminar')
                        .setDescription('Elimina una palabra clave')
                        .addStringOption(opt =>
                            opt
                                .setName('palabra')
                                .setDescription('Palabra clave a eliminar')
                                .setRequired(true)
                        )
                )
                .addSubcommand(sub =>
                    sub
                        .setName('listar')
                        .setDescription('Lista todas las palabras clave')
                )
        )

        // ===== CONFIG =====
        .addSubcommand(sub =>
            sub
                .setName('config')
                .setDescription('Configura el sistema de alertas')
        )

        // ===== API =====
        .addSubcommand(sub =>
            sub
                .setName('api')
                .setDescription('Muestra información sobre las API keys')
        )

        // ===== TEST =====
        .addSubcommand(sub =>
            sub
                .setName('test')
                .setDescription('Prueba la conexión con las APIs')
                .addStringOption(opt =>
                    opt
                        .setName('plataforma')
                        .setDescription('Plataforma a probar')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Twitch', value: 'twitch' },
                            { name: 'Kick', value: 'kick' },
                            { name: 'TikTok', value: 'tiktok' }
                        )
                )
                .addStringOption(opt =>
                    opt
                        .setName('username')
                        .setDescription('Username a verificar')
                        .setRequired(true)
                )
        )

        // ===== STATS =====
        .addSubcommand(sub =>
            sub
                .setName('stats')
                .setDescription('Estadísticas del sistema')
        )

        // ===== CHECK NOW =====
        .addSubcommand(sub =>
            sub
                .setName('check')
                .setDescription('Fuerza una verificación inmediata de todos los streamers')
        ),

    /**
     * @param {import('discord.js').ChatInputCommandInteraction} interaction
     * @param {import('discord.js').Client} client
     */
    async execute(interaction, client) {
        try {
            if (!interaction.guild) return;
            if (!interaction.isChatInputCommand()) return;

           // ===== VALIDAR PERMISOS =====
            const tienePermiso = await validarPermiso(interaction, 'encargados_streamer');

            if (!tienePermiso) {
                return interaction.reply({
                    content: '❌ No tienes permisos para usar este comando\n> Necesitas el permiso: `encargados_streamer`',
                    ephemeral: true
                });
            }
            const subcommandGroup = interaction.options.getSubcommandGroup();
            const subcommand = interaction.options.getSubcommand();

            // Grupo: streamer
            if (subcommandGroup === 'streamer') {
                switch (subcommand) {
                    case 'agregar':
                        await handleAgregarStreamer(interaction);
                        break;
                    case 'eliminar':
                        await handleEliminarStreamer(interaction);
                        break;
                    case 'listar':
                        await handleListarStreamers(interaction);
                        break;
                    case 'editar':
                        await handleEditarStreamer(interaction);
                        break;
                    case 'toggle':
                        await handleToggleStreamer(interaction);
                        break;
                }
                return;
            }

            // Grupo: keywords
            if (subcommandGroup === 'keywords') {
                switch (subcommand) {
                    case 'agregar':
                        await handleAgregarKeyword(interaction);
                        break;
                    case 'eliminar':
                        await handleEliminarKeyword(interaction);
                        break;
                    case 'listar':
                        await handleListarKeywords(interaction);
                        break;
                }
                return;
            }

            // Subcomandos principales
            switch (subcommand) {
                case 'setup':
                    await handleSetup(interaction, client);
                    break;
                case 'config':
                    await handleConfig(interaction);
                    break;
                case 'api':
                    await handleAPI(interaction);
                    break;
                case 'test':
                    await handleTest(interaction, client);
                    break;
                case 'stats':
                    await handleStats(interaction, client);
                    break;
                case 'check':
                    await handleCheckNow(interaction, client);
                    break;
                default:
                    await interaction.reply({
                        content: '❌ Subcomando no válido',
                        ephemeral: true
                    });
            }

        } catch (error) {
            console.error('Error en streamalert:', error);

            const errorMessage = `❌ Ocurrió un error: ${error.message}`;

            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({ content: errorMessage, ephemeral: true });
            } else {
                await interaction.followUp({ content: errorMessage, ephemeral: true });
            }
        }
    }
};

// ==================== FUNCIONES ====================

/**
 * Setup inicial
 */
async function handleSetup(interaction, client) {
    const canal = interaction.options.getChannel('canal');

    await interaction.deferReply({ ephemeral: true });

    try {
        // Verificar si ya existe una configuración
        const existing = await streamAlertSchema.findOne({
            guildId: interaction.guild.id
        });

        if (existing) {
            return interaction.editReply({
                content: `⚠️ Ya existe una configuración de alertas.\nCanal actual: <#${existing.alertChannelId}>\n\nUsa \`/streamalert config\` para modificarla.`
            });
        }

        // Crear configuración (sin API keys en la BD, se usan desde config.json)
        const newConfig = new streamAlertSchema({
            guildId: interaction.guild.id,
            alertChannelId: canal.id,
            streamers: [],
            globalKeywords: [],
            settings: {
                checkInterval: 10,
                autoDeleteMessages: true,
                includeThumbnail: true,
                defaultMessage: '🔴 ¡{streamer} está en vivo!',
                requireKeywords: false
            },
            createdBy: interaction.user.id
        });

        await newConfig.save();

        // Iniciar el sistema de monitoreo si no está iniciado
        if (!client._streamAlertMonitorInitialized) {
            const { initializeStreamMonitor } = require('../../Events/stream/streamMonitor');
            initializeStreamMonitor(client);
        }

        const embed = new EmbedBuilder()
            .setColor('#00FF00')
            .setTitle('✅ Sistema de Alertas Configurado')
            .setDescription(`El sistema de alertas de streaming ha sido configurado exitosamente.`)
            .addFields(
                { name: '📢 Canal de Alertas', value: `${canal}`, inline: true },
                { name: '⏱️ Intervalo de Verificación', value: '10 minutos', inline: true },
                { name: '\u200B', value: '\u200B', inline: true },
                { name: '📝 Próximos pasos', value: [
                    '1️⃣ Las API keys se configuran en `config.json`',
                    '2️⃣ Agrega streamers: `/streamalert streamer agregar`',
                    '3️⃣ (Opcional) Agrega palabras clave: `/streamalert keywords agregar`'
                ].join('\n'), inline: false }
            )
            .setFooter({ text: `Por ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() })
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });

    } catch (error) {
        console.error('Error en setup:', error);
        await interaction.editReply({ content: `❌ Error: ${error.message}` });
    }
}

/**
 * Agregar streamer
 */
async function handleAgregarStreamer(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const plataforma = interaction.options.getString('plataforma');
    const username = interaction.options.getString('username').toLowerCase();
    const nombre = interaction.options.getString('nombre') || username;
    const rol = interaction.options.getRole('rol');
    const mensaje = interaction.options.getString('mensaje');

    const config = await streamAlertSchema.findOne({
        guildId: interaction.guild.id
    });

    if (!config) {
        return interaction.editReply({
            content: '❌ No hay configuración de alertas. Usa `/streamalert setup` primero.'
        });
    }

    // Verificar si ya existe
    const existe = config.streamers.find(
        s => s.username.toLowerCase() === username && s.platform === plataforma
    );

    if (existe) {
        return interaction.editReply({
            content: `⚠️ El streamer **${username}** en **${plataforma}** ya está configurado.`
        });
    }

    // Generar ID único
    const streamerId = `${plataforma}_${username}_${Date.now()}`;

    // Agregar streamer
    config.streamers.push({
        streamerId,
        displayName: nombre,
        platform: plataforma,
        username,
        roleId: rol?.id || null,
        customMessage: mensaje,
        addedBy: interaction.user.id,
        enabled: true
    });

    await config.save();

    const platformEmoji = {
        twitch: '🟣',
        kick: '🟢',
        tiktok: '⚫'
    };

    const embed = new EmbedBuilder()
        .setColor(PLATFORM_COLORS[plataforma])
        .setTitle('✅ Streamer Agregado')
        .setDescription(`El streamer ha sido agregado al sistema de monitoreo.`)
        .addFields(
            { name: '🆔 ID', value: `\`${streamerId}\``, inline: false },
            { name: `${platformEmoji[plataforma]} Plataforma`, value: plataforma.toUpperCase(), inline: true },
            { name: '👤 Username', value: username, inline: true },
            { name: '📝 Nombre', value: nombre, inline: true },
            { name: '🔔 Rol a mencionar', value: rol ? `${rol}` : 'Ninguno', inline: true },
            { name: '💬 Mensaje personalizado', value: mensaje || 'Ninguno', inline: true },
            { name: '✅ Estado', value: 'Activo', inline: true }
        )
        .setFooter({ text: `Por ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() })
        .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
}

/**
 * Eliminar streamer
 */
async function handleEliminarStreamer(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const streamerId = interaction.options.getString('id');

    const config = await streamAlertSchema.findOne({
        guildId: interaction.guild.id
    });

    if (!config) {
        return interaction.editReply({
            content: '❌ No hay configuración de alertas.'
        });
    }

    const index = config.streamers.findIndex(s => s.streamerId === streamerId);

    if (index === -1) {
        return interaction.editReply({
            content: `❌ No se encontró un streamer con ID \`${streamerId}\`.\nUsa \`/streamalert streamer listar\` para ver los IDs.`
        });
    }

    const removed = config.streamers.splice(index, 1)[0];

    // Eliminar mensaje de alerta si existe
    if (removed.lastMessageId) {
        try {
            const channel = interaction.guild.channels.cache.get(config.alertChannelId);
            if (channel) {
                const message = await channel.messages.fetch(removed.lastMessageId).catch(() => null);
                if (message) await message.delete();
            }
        } catch (error) {
            console.error('Error eliminando mensaje de alerta:', error);
        }
    }

    await config.save();

    const embed = new EmbedBuilder()
        .setColor('#FF0000')
        .setTitle('🗑️ Streamer Eliminado')
        .addFields(
            { name: '👤 Nombre', value: removed.displayName, inline: true },
            { name: '🎮 Plataforma', value: removed.platform.toUpperCase(), inline: true },
            { name: '📊 Streams totales', value: `${removed.stats?.totalStreams || 0}`, inline: true }
        )
        .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
}

/**
 * Listar streamers
 */
async function handleListarStreamers(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const config = await streamAlertSchema.findOne({
        guildId: interaction.guild.id
    });

    if (!config) {
        return interaction.editReply({
            content: '❌ No hay configuración de alertas.'
        });
    }

    if (!config.streamers || config.streamers.length === 0) {
        return interaction.editReply({
            content: '📋 No hay streamers configurados.\nUsa `/streamalert streamer agregar` para agregar uno.'
        });
    }

    const embed = new EmbedBuilder()
        .setColor('#0099FF')
        .setTitle('📋 Streamers Configurados')
        .setDescription(`Total: **${config.streamers.length}**`)
        .setTimestamp()
        .setFooter({ text: interaction.guild.name, iconURL: interaction.guild.iconURL() });

    const platformEmoji = {
        twitch: '🟣',
        kick: '🟢',
        tiktok: '⚫'
    };

    for (const streamer of config.streamers) {
        const status = streamer.isLive ? '🔴 EN VIVO' : '⚪ Offline';
        const enabled = streamer.enabled ? '✅' : '❌';
        const role = streamer.roleId ? `<@&${streamer.roleId}>` : 'Ninguno';

        embed.addFields({
            name: `${platformEmoji[streamer.platform]} ${streamer.displayName} ${enabled}`,
            value: [
                `**ID:** \`${streamer.streamerId}\``,
                `**Username:** ${streamer.username}`,
                `**Estado:** ${status}`,
                `**Rol:** ${role}`,
                `**Streams:** ${streamer.stats?.totalStreams || 0}`
            ].join('\n'),
            inline: false
        });
    }

    await interaction.editReply({ embeds: [embed] });
}

/**
 * Toggle streamer (activar/desactivar)
 */
async function handleToggleStreamer(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const streamerId = interaction.options.getString('id');

    const config = await streamAlertSchema.findOne({
        guildId: interaction.guild.id
    });

    if (!config) {
        return interaction.editReply({
            content: '❌ No hay configuración de alertas.'
        });
    }

    const streamer = config.streamers.find(s => s.streamerId === streamerId);

    if (!streamer) {
        return interaction.editReply({
            content: `❌ No se encontró un streamer con ID \`${streamerId}\`.`
        });
    }

    streamer.enabled = !streamer.enabled;
    await config.save();

    const embed = new EmbedBuilder()
        .setColor(streamer.enabled ? '#00FF00' : '#FFA500')
        .setTitle(streamer.enabled ? '✅ Streamer Activado' : '⚠️ Streamer Desactivado')
        .addFields(
            { name: '👤 Nombre', value: streamer.displayName, inline: true },
            { name: '🎮 Plataforma', value: streamer.platform.toUpperCase(), inline: true },
            { name: '✅ Estado', value: streamer.enabled ? 'Activo' : 'Inactivo', inline: true }
        )
        .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
}

/**
 * Editar streamer
 */
async function handleEditarStreamer(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const streamerId = interaction.options.getString('id');

    const config = await streamAlertSchema.findOne({
        guildId: interaction.guild.id
    });

    if (!config) {
        return interaction.editReply({
            content: '❌ No hay configuración de alertas.'
        });
    }

    const streamer = config.streamers.find(s => s.streamerId === streamerId);

    if (!streamer) {
        return interaction.editReply({
            content: `❌ No se encontró un streamer con ID \`${streamerId}\`.`
        });
    }

    // Crear menú de selección
    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId(`sa_edit_${streamerId}`)
        .setPlaceholder('Selecciona qué editar')
        .addOptions(
            new StringSelectMenuOptionBuilder()
                .setLabel('Cambiar nombre de display')
                .setValue('displayname')
                .setEmoji('📝'),
            new StringSelectMenuOptionBuilder()
                .setLabel('Cambiar rol a mencionar')
                .setValue('role')
                .setEmoji('🔔'),
            new StringSelectMenuOptionBuilder()
                .setLabel('Cambiar mensaje personalizado')
                .setValue('message')
                .setEmoji('💬')
        );

    const row = new ActionRowBuilder().addComponents(selectMenu);

    const embed = new EmbedBuilder()
        .setColor(PLATFORM_COLORS[streamer.platform])
        .setTitle('⚙️ Editar Streamer')
        .addFields(
            { name: '👤 Nombre actual', value: streamer.displayName, inline: true },
            { name: '🔔 Rol actual', value: streamer.roleId ? `<@&${streamer.roleId}>` : 'Ninguno', inline: true },
            { name: '💬 Mensaje actual', value: streamer.customMessage || 'Ninguno', inline: false }
        );

    await interaction.editReply({ embeds: [embed], components: [row] });
}

/**
 * Agregar keyword
 */
async function handleAgregarKeyword(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const palabra = interaction.options.getString('palabra').toLowerCase();

    const config = await streamAlertSchema.findOne({
        guildId: interaction.guild.id
    });

    if (!config) {
        return interaction.editReply({
            content: '❌ No hay configuración de alertas.'
        });
    }

    // Verificar si ya existe
    if (config.globalKeywords.find(k => k.keyword.toLowerCase() === palabra)) {
        return interaction.editReply({
            content: `⚠️ La palabra clave **${palabra}** ya existe.`
        });
    }

    config.globalKeywords.push({
        keyword: palabra,
        addedBy: interaction.user.id
    });

    await config.save();

    const embed = new EmbedBuilder()
        .setColor('#00FF00')
        .setTitle('✅ Palabra Clave Agregada')
        .addFields(
            { name: '🔑 Palabra', value: `\`${palabra}\``, inline: true },
            { name: '📊 Total Keywords', value: `${config.globalKeywords.length}`, inline: true }
        )
        .setDescription('Las notificaciones se enviarán cuando el título del stream contenga esta palabra.')
        .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
}

/**
 * Eliminar keyword
 */
async function handleEliminarKeyword(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const palabra = interaction.options.getString('palabra').toLowerCase();

    const config = await streamAlertSchema.findOne({
        guildId: interaction.guild.id
    });

    if (!config) {
        return interaction.editReply({
            content: '❌ No hay configuración de alertas.'
        });
    }

    const index = config.globalKeywords.findIndex(k => k.keyword.toLowerCase() === palabra);

    if (index === -1) {
        return interaction.editReply({
            content: `❌ No se encontró la palabra clave **${palabra}**.`
        });
    }

    config.globalKeywords.splice(index, 1);
    await config.save();

    const embed = new EmbedBuilder()
        .setColor('#FF0000')
        .setTitle('🗑️ Palabra Clave Eliminada')
        .addFields(
            { name: '🔑 Palabra', value: `\`${palabra}\``, inline: true },
            { name: '📊 Keywords Restantes', value: `${config.globalKeywords.length}`, inline: true }
        )
        .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
}

/**
 * Listar keywords
 */
async function handleListarKeywords(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const config = await streamAlertSchema.findOne({
        guildId: interaction.guild.id
    });

    if (!config) {
        return interaction.editReply({
            content: '❌ No hay configuración de alertas.'
        });
    }

    if (!config.globalKeywords || config.globalKeywords.length === 0) {
        return interaction.editReply({
            content: '📋 No hay palabras clave configuradas.\n💡 Las palabras clave permiten filtrar qué streams notificar basándose en su título.'
        });
    }

    const keywords = config.globalKeywords.map(k => `\`${k.keyword}\``).join(', ');

    const embed = new EmbedBuilder()
        .setColor('#0099FF')
        .setTitle('🔑 Palabras Clave Globales')
        .setDescription(`Total: **${config.globalKeywords.length}**\n\n${keywords}`)
        .addFields({
            name: '💡 Funcionamiento',
            value: config.settings.requireKeywords 
                ? 'Se enviarán notificaciones **SOLO** si el título contiene alguna de estas palabras.'
                : 'Las keywords son opcionales. Se notifican todos los streams.'
        })
        .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
}

/**
 * Configuración
 */
async function handleConfig(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const config = await streamAlertSchema.findOne({
        guildId: interaction.guild.id
    });

    if (!config) {
        return interaction.editReply({
            content: '❌ No hay configuración de alertas.'
        });
    }

    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('sa_config_menu')
        .setPlaceholder('Selecciona qué configurar')
        .addOptions(
            new StringSelectMenuOptionBuilder()
                .setLabel('Intervalo de verificación')
                .setValue('interval')
                .setEmoji('⏱️'),
            new StringSelectMenuOptionBuilder()
                .setLabel('Auto-eliminar mensajes')
                .setValue('autodelete')
                .setEmoji('🗑️'),
            new StringSelectMenuOptionBuilder()
                .setLabel('Incluir thumbnail')
                .setValue('thumbnail')
                .setEmoji('🖼️'),
            new StringSelectMenuOptionBuilder()
                .setLabel('Mensaje por defecto')
                .setValue('message')
                .setEmoji('💬'),
            new StringSelectMenuOptionBuilder()
                .setLabel('Requerir keywords')
                .setValue('keywords')
                .setEmoji('🔑'),
            new StringSelectMenuOptionBuilder()
                .setLabel('Cambiar canal de alertas')
                .setValue('channel')
                .setEmoji('📢')
        );

    const row = new ActionRowBuilder().addComponents(selectMenu);

    const embed = new EmbedBuilder()
        .setColor('#0099FF')
        .setTitle('⚙️ Configuración del Sistema')
        .addFields(
            { name: '📢 Canal de alertas', value: `<#${config.alertChannelId}>`, inline: true },
            { name: '⏱️ Intervalo', value: `${config.settings.checkInterval} min`, inline: true },
            { name: '🗑️ Auto-eliminar', value: config.settings.autoDeleteMessages ? 'Sí' : 'No', inline: true },
            { name: '🖼️ Thumbnail', value: config.settings.includeThumbnail ? 'Sí' : 'No', inline: true },
            { name: '🔑 Requerir keywords', value: config.settings.requireKeywords ? 'Sí' : 'No', inline: true },
            { name: '💬 Mensaje por defecto', value: `\`${config.settings.defaultMessage}\``, inline: false }
        )
        .setTimestamp();

    await interaction.editReply({ embeds: [embed], components: [row] });
}

/**
 * Mostrar información sobre API keys
 */
async function handleAPI(interaction) {
    await interaction.deferReply({ ephemeral: true });

    // Cargar config.json para verificar las API keys
    const { loadConfig } = require('../../utils/streamAPIs');
    const appConfig = loadConfig();

    const embed = new EmbedBuilder()
        .setColor('#9146FF')
        .setTitle('🔑 Configuración de API Keys')
        .setDescription([
            '**Las API keys se configuran en `config.json`**',
            '',
            '**Twitch API:**',
            '1. Ve a https://dev.twitch.tv/console/apps',
            '2. Crea una nueva aplicación',
            '3. Obtén tu Client ID y Client Secret',
            '4. Agrégalos en `config.json`:',
            '```json',
            '"apiKeys": {',
            '  "twitchClientId": "tu_client_id",',
            '  "twitchClientSecret": "tu_client_secret",',
            '  "kickClientId": "tu_kick_client_id",',
            '  "kickClientSecret": "tu_kick_client_secret"',
            '}',
            '```',
            '',
            '**Kick API:**',
            '1. Registra una aplicación en el portal de desarrolladores de Kick',
            '2. Obtén tu Client ID y Client Secret',
            '3. Agrégalos en `config.json`',
            '',
            '**TikTok:** No requiere API keys para streams públicos.'
        ].join('\n'))
        .addFields(
            { 
                name: '🟣 Twitch Client ID', 
                value: appConfig.apiKeys?.twitchClientId ? '✅ Configurado' : '❌ No configurado', 
                inline: true 
            },
            { 
                name: '🟣 Twitch Secret', 
                value: appConfig.apiKeys?.twitchClientSecret ? '✅ Configurado' : '❌ No configurado', 
                inline: true 
            },
            { 
                name: '🟢 Kick Client ID', 
                value: appConfig.apiKeys?.kickClientId ? '✅ Configurado' : '❌ No configurado', 
                inline: true 
            },
            { 
                name: '🟢 Kick Secret', 
                value: appConfig.apiKeys?.kickClientSecret ? '✅ Configurado' : '❌ No configurado', 
                inline: true 
            }
        )
        .setFooter({ text: 'Reinicia el bot después de modificar config.json' })
        .setTimestamp();
    
    await interaction.editReply({ embeds: [embed] });
}

/**
 * Test API connection
 */
async function handleTest(interaction, client) {
    await interaction.deferReply({ ephemeral: true });

    const plataforma = interaction.options.getString('plataforma');
    const username = interaction.options.getString('username');

    // Importar el módulo de APIs (ya no necesita config como parámetro)
    const { checkStreamStatus } = require('../../utils/streamAPIs');

    try {
        const result = await checkStreamStatus(plataforma, username);

        const embed = new EmbedBuilder()
            .setColor(result.isLive ? '#00FF00' : '#FFA500')
            .setTitle(`${result.isLive ? '🔴' : '⚪'} Test de API - ${plataforma.toUpperCase()}`)
            .addFields(
                { name: '👤 Usuario', value: username, inline: true },
                { name: '📡 Estado', value: result.isLive ? 'En vivo' : 'Offline', inline: true },
                { name: '✅ Conexión', value: 'Exitosa', inline: true }
            );

        if (result.isLive) {
            embed.addFields(
                { name: '📝 Título', value: result.title || 'N/A', inline: false },
                { name: '👥 Viewers', value: `${result.viewers || 0}`, inline: true },
                { name: '🕐 Inicio', value: result.startedAt ? `<t:${Math.floor(new Date(result.startedAt).getTime() / 1000)}:R>` : 'N/A', inline: true }
            );

            if (result.thumbnail) {
                embed.setImage(result.thumbnail);
            }
        }

        await interaction.editReply({ embeds: [embed] });

    } catch (error) {
        console.error('Error en test:', error);
        
        const embed = new EmbedBuilder()
            .setColor('#FF0000')
            .setTitle('❌ Error en Test de API')
            .setDescription(`No se pudo conectar con la API de ${plataforma.toUpperCase()}`)
            .addFields(
                { name: 'Error', value: error.message, inline: false },
                {
                    name: '💡 Solución',
                    value: 'Verifica que las API keys estén configuradas correctamente en `config.json`'
                }
            );

        await interaction.editReply({ embeds: [embed] });
    }
}

/**
 * Estadísticas
 */
async function handleStats(interaction, client) {
    await interaction.deferReply({ ephemeral: true });

    const config = await streamAlertSchema.findOne({
        guildId: interaction.guild.id
    });

    if (!config) {
        return interaction.editReply({
            content: '❌ No hay configuración de alertas.'
        });
    }

    const totalStreamers = config.streamers.length;
    const activeStreamers = config.streamers.filter(s => s.enabled).length;
    const liveStreamers = config.streamers.filter(s => s.isLive).length;
    const totalKeywords = config.globalKeywords.length;

    // Estadísticas por plataforma
    const platformStats = {
        twitch: config.streamers.filter(s => s.platform === 'twitch').length,
        kick: config.streamers.filter(s => s.platform === 'kick').length,
        tiktok: config.streamers.filter(s => s.platform === 'tiktok').length
    };

    const embed = new EmbedBuilder()
        .setColor('#0099FF')
        .setTitle('📊 Estadísticas del Sistema')
        .addFields(
            { name: '🎮 Streamers Totales', value: `${totalStreamers}`, inline: true },
            { name: '✅ Activos', value: `${activeStreamers}`, inline: true },
            { name: '🔴 En Vivo', value: `${liveStreamers}`, inline: true },
            { name: '🟣 Twitch', value: `${platformStats.twitch}`, inline: true },
            { name: '🟢 Kick', value: `${platformStats.kick}`, inline: true },
            { name: '⚫ TikTok', value: `${platformStats.tiktok}`, inline: true },
            { name: '🔑 Keywords', value: `${totalKeywords}`, inline: true },
            { name: '📢 Notificaciones', value: `${config.stats?.totalNotificationsSent || 0}`, inline: true },
            { name: '🕐 Última verificación', value: config.stats?.lastCheck ? `<t:${Math.floor(config.stats.lastCheck.getTime() / 1000)}:R>` : 'Nunca', inline: true }
        )
        .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
}

/**
 * Forzar verificación
 */
async function handleCheckNow(interaction, client) {
    await interaction.deferReply({ ephemeral: true });

    const config = await streamAlertSchema.findOne({
        guildId: interaction.guild.id
    });

    if (!config) {
        return interaction.editReply({
            content: '❌ No hay configuración de alertas.'
        });
    }

    await interaction.editReply({
        content: '⏳ Verificando el estado de todos los streamers...'
    });

    try {
        // Importar y ejecutar la función de verificación
        const { checkAllStreams } = require('../../Events/stream/streamMonitor');
        const results = await checkAllStreams(client, config);

        const embed = new EmbedBuilder()
            .setColor('#00FF00')
            .setTitle('✅ Verificación Completada')
            .addFields(
                { name: '📊 Streamers verificados', value: `${results.checked}`, inline: true },
                { name: '🔴 En vivo', value: `${results.live}`, inline: true },
                { name: '📢 Notificaciones enviadas', value: `${results.notificationsSent}`, inline: true }
            )
            .setTimestamp();

        await interaction.editReply({ content: null, embeds: [embed] });

    } catch (error) {
        console.error('Error en check now:', error);
        await interaction.editReply({
            content: `❌ Error durante la verificación: ${error.message}`
        });
    }
}