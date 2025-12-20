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

const tempVoiceSchema = require('../../Models/tempVoiceConfig');
const permisosEspecialSchema = require('../../Models/permisosEspecial');

// ===== PERMISOS DE DISCORD ORGANIZADOS POR CATEGORÍAS =====
const CATEGORIAS_PERMISOS = {
    generales: [
        { name: '👁️ Ver Canal', value: 'ViewChannel', emoji: '👁️' },
        { name: '⚙️ Gestionar Canal', value: 'ManageChannels', emoji: '⚙️' },
        { name: '🔐 Gestionar Permisos', value: 'ManageRoles', emoji: '🔐' },
        { name: '📨 Crear Invitación', value: 'CreateInstantInvite', emoji: '📨' },
    ],
    voz: [
        { name: '🔊 Conectar', value: 'Connect', emoji: '🔊' },
        { name: '🗣️ Hablar', value: 'Speak', emoji: '🗣️' },
        { name: '📺 Compartir Pantalla', value: 'Stream', emoji: '📺' },
        { name: '🎙️ Usar Actividad de Voz', value: 'UseVAD', emoji: '🎙️' },
        { name: '⭐ Prioridad de Palabra', value: 'PrioritySpeaker', emoji: '⭐' },
        { name: '🔇 Silenciar Miembros', value: 'MuteMembers', emoji: '🔇' },
        { name: '🔕 Ensordecer Miembros', value: 'DeafenMembers', emoji: '🔕' },
        { name: '↔️ Mover Miembros', value: 'MoveMembers', emoji: '↔️' },
        { name: '🎵 Usar Soundboard', value: 'UseSoundboard', emoji: '🎵' },
        { name: '🎶 Sonidos Externos', value: 'UseExternalSounds', emoji: '🎶' },
    ],
    texto: [
        { name: '💬 Enviar Mensajes', value: 'SendMessages', emoji: '💬' },
        { name: '🔗 Insertar Enlaces', value: 'EmbedLinks', emoji: '🔗' },
        { name: '📎 Adjuntar Archivos', value: 'AttachFiles', emoji: '📎' },
        { name: '👍 Añadir Reacciones', value: 'AddReactions', emoji: '👍' },
        { name: '😀 Emojis Externos', value: 'UseExternalEmojis', emoji: '😀' },
        { name: '📜 Leer Historial', value: 'ReadMessageHistory', emoji: '📜' },
        { name: '🗑️ Gestionar Mensajes', value: 'ManageMessages', emoji: '🗑️' },
    ]
};

// Todos los permisos en un array
const TODOS_PERMISOS = Object.values(CATEGORIAS_PERMISOS).flat();

module.exports = {
    data: new SlashCommandBuilder()
        .setName('tempvoice')
        .setDescription('Configura el sistema de canales de voz temporales')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)

        // ===== SETUP INICIAL =====
        .addSubcommand(sub =>
            sub
                .setName('setup')
                .setDescription('Crea un nuevo generador de voces temporales')
                .addChannelOption(opt =>
                    opt
                        .setName('categoria')
                        .setDescription('Categoría donde se crearán los canales')
                        .setRequired(true)
                        .addChannelTypes(ChannelType.GuildCategory)
                )
                .addStringOption(opt =>
                    opt
                        .setName('nombre')
                        .setDescription('Nombre del canal generador')
                        .setRequired(false)
                )
        )

        // ===== GRUPO: AÑADIR PERMISOS POR CATEGORÍA =====
        .addSubcommandGroup(group =>
            group
                .setName('añadir')
                .setDescription('Añade permisos a un rol')
                .addSubcommand(sub =>
                    sub
                        .setName('generales')
                        .setDescription('Permisos generales del canal')
                        .addChannelOption(opt =>
                            opt.setName('generador')
                                .setDescription('Canal generador')
                                .setRequired(true)
                                .addChannelTypes(ChannelType.GuildVoice)
                        )
                        .addRoleOption(opt =>
                            opt.setName('rol')
                                .setDescription('Rol a modificar')
                                .setRequired(true)
                        )
                        .addStringOption(opt =>
                            opt.setName('permiso')
                                .setDescription('Permiso a añadir')
                                .setRequired(true)
                                .addChoices(...CATEGORIAS_PERMISOS.generales.map(p => ({ name: p.name, value: p.value })))
                        )
                )
                .addSubcommand(sub =>
                    sub
                        .setName('voz')
                        .setDescription('Permisos de voz')
                        .addChannelOption(opt =>
                            opt.setName('generador')
                                .setDescription('Canal generador')
                                .setRequired(true)
                                .addChannelTypes(ChannelType.GuildVoice)
                        )
                        .addRoleOption(opt =>
                            opt.setName('rol')
                                .setDescription('Rol a modificar')
                                .setRequired(true)
                        )
                        .addStringOption(opt =>
                            opt.setName('permiso')
                                .setDescription('Permiso a añadir')
                                .setRequired(true)
                                .addChoices(...CATEGORIAS_PERMISOS.voz.map(p => ({ name: p.name, value: p.value })))
                        )
                )
                .addSubcommand(sub =>
                    sub
                        .setName('texto')
                        .setDescription('Permisos de texto en canal de voz')
                        .addChannelOption(opt =>
                            opt.setName('generador')
                                .setDescription('Canal generador')
                                .setRequired(true)
                                .addChannelTypes(ChannelType.GuildVoice)
                        )
                        .addRoleOption(opt =>
                            opt.setName('rol')
                                .setDescription('Rol a modificar')
                                .setRequired(true)
                        )
                        .addStringOption(opt =>
                            opt.setName('permiso')
                                .setDescription('Permiso a añadir')
                                .setRequired(true)
                                .addChoices(...CATEGORIAS_PERMISOS.texto.map(p => ({ name: p.name, value: p.value })))
                        )
                )
        )

        // ===== GRUPO: ROLES =====
        .addSubcommandGroup(group =>
            group
                .setName('rol')
                .setDescription('Gestiona roles del generador')
                .addSubcommand(sub =>
                    sub
                        .setName('agregar')
                        .setDescription('Agrega un rol con permisos básicos')
                        .addChannelOption(opt =>
                            opt.setName('generador')
                                .setDescription('Canal generador')
                                .setRequired(true)
                                .addChannelTypes(ChannelType.GuildVoice)
                        )
                        .addRoleOption(opt =>
                            opt.setName('rol')
                                .setDescription('Rol a agregar')
                                .setRequired(true)
                        )
                        .addBooleanOption(opt =>
                            opt.setName('puede_crear')
                                .setDescription('¿Este rol puede crear canales temporales?')
                                .setRequired(true)
                        )
                )
                .addSubcommand(sub =>
                    sub
                        .setName('eliminar')
                        .setDescription('Elimina un rol del generador')
                        .addChannelOption(opt =>
                            opt.setName('generador')
                                .setDescription('Canal generador')
                                .setRequired(true)
                                .addChannelTypes(ChannelType.GuildVoice)
                        )
                        .addRoleOption(opt =>
                            opt.setName('rol')
                                .setDescription('Rol a eliminar')
                                .setRequired(true)
                        )
                )
                .addSubcommand(sub =>
                    sub
                        .setName('listar')
                        .setDescription('Lista roles y sus permisos')
                        .addChannelOption(opt =>
                            opt.setName('generador')
                                .setDescription('Canal generador')
                                .setRequired(true)
                                .addChannelTypes(ChannelType.GuildVoice)
                        )
                )
                .addSubcommand(sub =>
                    sub
                        .setName('limpiar')
                        .setDescription('Limpia todos los permisos de un rol')
                        .addChannelOption(opt =>
                            opt.setName('generador')
                                .setDescription('Canal generador')
                                .setRequired(true)
                                .addChannelTypes(ChannelType.GuildVoice)
                        )
                        .addRoleOption(opt =>
                            opt.setName('rol')
                                .setDescription('Rol a limpiar')
                                .setRequired(true)
                        )
                )
        )

        // ===== REMOVER PERMISO =====
        .addSubcommand(sub =>
            sub
                .setName('remover')
                .setDescription('Remueve un permiso de un rol (menú interactivo)')
                .addChannelOption(opt =>
                    opt.setName('generador')
                        .setDescription('Canal generador')
                        .setRequired(true)
                        .addChannelTypes(ChannelType.GuildVoice)
                )
                .addRoleOption(opt =>
                    opt.setName('rol')
                        .setDescription('Rol del que remover permiso')
                        .setRequired(true)
                )
        )

        // ===== MÚLTIPLES PERMISOS =====
        .addSubcommand(sub =>
            sub
                .setName('multiple')
                .setDescription('Añade múltiples permisos a un rol')
                .addChannelOption(opt =>
                    opt.setName('generador')
                        .setDescription('Canal generador')
                        .setRequired(true)
                        .addChannelTypes(ChannelType.GuildVoice)
                )
                .addRoleOption(opt =>
                    opt.setName('rol')
                        .setDescription('Rol a modificar')
                        .setRequired(true)
                )
        )

        // ===== LISTAR GENERADORES =====
        .addSubcommand(sub =>
            sub
                .setName('listar')
                .setDescription('Lista todos los generadores configurados')
        )

        // ===== ELIMINAR GENERADOR =====
        .addSubcommand(sub =>
            sub
                .setName('eliminar')
                .setDescription('Elimina un generador')
                .addChannelOption(opt =>
                    opt.setName('generador')
                        .setDescription('Canal generador a eliminar')
                        .setRequired(true)
                        .addChannelTypes(ChannelType.GuildVoice)
                )
        )

        // ===== CONFIGURAR =====
        .addSubcommand(sub =>
            sub
                .setName('configurar')
                .setDescription('Configura ajustes del generador')
                .addChannelOption(opt =>
                    opt.setName('generador')
                        .setDescription('Canal generador')
                        .setRequired(true)
                        .addChannelTypes(ChannelType.GuildVoice)
                )
        )

        // ===== ESTADÍSTICAS =====
        .addSubcommand(sub =>
            sub
                .setName('stats')
                .setDescription('Estadísticas del sistema')
        )

        // ===== LIMPIAR CANALES =====
        .addSubcommand(sub =>
            sub
                .setName('limpiar')
                .setDescription('Limpia canales temporales vacíos')
        ),

    // Exportar constantes para uso en otros archivos
    CATEGORIAS_PERMISOS,
    TODOS_PERMISOS,

    /**
     * @param {import('discord.js').ChatInputCommandInteraction} interaction
     * @param {import('discord.js').Client} client
     */
    async execute(interaction, client) {
        try {
            if (!interaction.guild) return;
            if (!interaction.isChatInputCommand()) return;

            // Validar permisos especiales
            const validarEspecial = await permisosEspecialSchema.findOne({
                guildServidor: interaction.guild.id,
                guildUsuario: interaction.user.id
            });

            if (!validarEspecial) {
                return interaction.reply({
                    content: '❌ No tienes permisos para usar este comando',
                    ephemeral: true
                });
            }

            const subcommandGroup = interaction.options.getSubcommandGroup();
            const subcommand = interaction.options.getSubcommand();

            // Grupo: añadir permisos
            if (subcommandGroup === 'añadir') {
                await handleAñadirPermiso(interaction, subcommand);
                return;
            }

            // Grupo: roles
            if (subcommandGroup === 'rol') {
                switch (subcommand) {
                    case 'agregar':
                        await handleAgregarRol(interaction);
                        break;
                    case 'eliminar':
                        await handleEliminarRol(interaction);
                        break;
                    case 'listar':
                        await handleListarRoles(interaction);
                        break;
                    case 'limpiar':
                        await handleLimpiarRol(interaction);
                        break;
                }
                return;
            }

            // Subcomandos principales
            switch (subcommand) {
                case 'setup':
                    await handleSetup(interaction, client);
                    break;
                case 'remover':
                    await handleRemoverPermiso(interaction);
                    break;
                case 'multiple':
                    await handleMultiple(interaction);
                    break;
                case 'listar':
                    await handleListarGeneradores(interaction);
                    break;
                case 'eliminar':
                    await handleEliminarGenerador(interaction);
                    break;
                case 'configurar':
                    await handleConfigurar(interaction);
                    break;
                case 'stats':
                    await handleStats(interaction, client);
                    break;
                case 'limpiar':
                    await handleLimpiarCanales(interaction, client);
                    break;
                default:
                    await interaction.reply({
                        content: '❌ Subcomando no válido',
                        ephemeral: true
                    });
            }

        } catch (error) {
            console.error('Error en tempvoice:', error);

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
 * Setup inicial - Crea el generador
 */
async function handleSetup(interaction, client) {
    const categoria = interaction.options.getChannel('categoria');
    const nombre = interaction.options.getString('nombre') || '➕ Crear Canal de Voz';

    await interaction.deferReply({ ephemeral: true });

    try {
        // Crear canal generador
        const generatorChannel = await interaction.guild.channels.create({
            name: nombre,
            type: ChannelType.GuildVoice,
            parent: categoria.id,
            userLimit: 1
        });

        // Guardar en base de datos
        const newConfig = new tempVoiceSchema({
            guildId: interaction.guild.id,
            generatorChannelId: generatorChannel.id,
            categoryId: categoria.id,
            rolesPermisos: [],
            settings: {
                defaultName: '🎧 Sala de {user}',
                userLimit: 0,
                bitrate: 64000,
                privateByDefault: true
            },
            createdBy: interaction.user.id
        });

        await newConfig.save();

        const embed = new EmbedBuilder()
            .setColor('#00FF00')
            .setTitle('✅ Generador Creado')
            .setDescription(`Se ha creado el generador de voces temporales.\n\n**Siguiente paso:** Configura los roles con sus permisos usando:\n\`/tempvoice rol agregar\`\n\`/tempvoice añadir voz\``)
            .addFields(
                { name: '📁 Categoría', value: `${categoria}`, inline: true },
                { name: '🎤 Generador', value: `${generatorChannel}`, inline: true },
                { name: '📝 Nombre de canales', value: `\`🎧 Sala de {user}\``, inline: false }
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
 * Añade un permiso a un rol
 */
async function handleAñadirPermiso(interaction, categoria) {
    await interaction.deferReply({ ephemeral: true });

    const generador = interaction.options.getChannel('generador');
    const rol = interaction.options.getRole('rol');
    const permiso = interaction.options.getString('permiso');

    let config = await tempVoiceSchema.findOne({
        guildId: interaction.guild.id,
        generatorChannelId: generador.id
    });

    if (!config) {
        return interaction.editReply({
            content: `❌ El canal ${generador} no es un generador de voz temporal.`
        });
    }

    // Buscar el rol
    let roleData = config.rolesPermisos.find(r => r.roleId === rol.id);

    if (!roleData) {
        // Crear rol si no existe
        config.rolesPermisos.push({
            roleId: rol.id,
            roleName: rol.name,
            permisos: [permiso],
            puedeCrear: false,
            addedBy: interaction.user.id
        });
        roleData = config.rolesPermisos[config.rolesPermisos.length - 1];
    } else {
        // Verificar si ya tiene el permiso
        if (roleData.permisos.includes(permiso)) {
            return interaction.editReply({
                content: `⚠️ El rol ${rol} ya tiene el permiso **${permiso}**`
            });
        }
        roleData.permisos.push(permiso);
    }

    await config.save();

    const permisoInfo = TODOS_PERMISOS.find(p => p.value === permiso);

    const embed = new EmbedBuilder()
        .setColor('#00FF00')
        .setTitle('✅ Permiso Añadido')
        .addFields(
            { name: '🎤 Generador', value: `${generador}`, inline: true },
            { name: '👥 Rol', value: `${rol}`, inline: true },
            { name: '🔐 Permiso', value: `${permisoInfo?.emoji || '✓'} ${permisoInfo?.name || permiso}`, inline: true },
            { name: '📊 Total Permisos', value: `${roleData.permisos.length}`, inline: true }
        )
        .setTimestamp()
        .setFooter({ text: `Por ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() });

    return interaction.editReply({ embeds: [embed] });
}

/**
 * Agregar un rol al generador
 */
async function handleAgregarRol(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const generador = interaction.options.getChannel('generador');
    const rol = interaction.options.getRole('rol');
    const puedeCrear = interaction.options.getBoolean('puede_crear');

    let config = await tempVoiceSchema.findOne({
        guildId: interaction.guild.id,
        generatorChannelId: generador.id
    });

    if (!config) {
        return interaction.editReply({
            content: `❌ El canal ${generador} no es un generador.`
        });
    }

    // Verificar si ya existe
    if (config.rolesPermisos.find(r => r.roleId === rol.id)) {
        return interaction.editReply({
            content: `⚠️ El rol ${rol} ya está configurado.`
        });
    }

    // No añadir permisos por defecto - se configuran después
    config.rolesPermisos.push({
        roleId: rol.id,
        roleName: rol.name,
        permisos: [],
        puedeCrear: puedeCrear,
        addedBy: interaction.user.id
    });

    await config.save();

    const embed = new EmbedBuilder()
        .setColor('#00FF00')
        .setTitle('✅ Rol Agregado')
        .setDescription(`Ahora configura los permisos usando:\n\`/tempvoice añadir generales\`\n\`/tempvoice añadir voz\`\n\`/tempvoice añadir texto\`\n\nO usa \`/tempvoice multiple\` para añadir varios a la vez.`)
        .addFields(
            { name: '🎤 Generador', value: `${generador}`, inline: true },
            { name: '👥 Rol', value: `${rol}`, inline: true },
            { name: '🔑 Puede Crear', value: puedeCrear ? '✅ Sí' : '❌ No', inline: true },
            { name: '🔐 Permisos', value: 'Sin configurar - añádelos con los comandos de arriba', inline: false }
        )
        .setTimestamp()
        .setFooter({ text: `Por ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() });

    return interaction.editReply({ embeds: [embed] });
}

/**
 * Eliminar un rol del generador
 */
async function handleEliminarRol(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const generador = interaction.options.getChannel('generador');
    const rol = interaction.options.getRole('rol');

    const config = await tempVoiceSchema.findOne({
        guildId: interaction.guild.id,
        generatorChannelId: generador.id
    });

    if (!config) {
        return interaction.editReply({
            content: `❌ El canal ${generador} no es un generador.`
        });
    }

    const index = config.rolesPermisos.findIndex(r => r.roleId === rol.id);

    if (index === -1) {
        return interaction.editReply({
            content: `❌ El rol ${rol} no está configurado.`
        });
    }

    const removed = config.rolesPermisos.splice(index, 1)[0];
    await config.save();

    const embed = new EmbedBuilder()
        .setColor('#FF0000')
        .setTitle('🗑️ Rol Eliminado')
        .addFields(
            { name: '🎤 Generador', value: `${generador}`, inline: true },
            { name: '👥 Rol', value: `${rol}`, inline: true },
            { name: '🔐 Permisos que tenía', value: removed.permisos.length > 0 ? removed.permisos.join(', ') : 'Ninguno', inline: false }
        )
        .setTimestamp();

    return interaction.editReply({ embeds: [embed] });
}

/**
 * Listar roles y permisos de un generador
 */
async function handleListarRoles(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const generador = interaction.options.getChannel('generador');

    const config = await tempVoiceSchema.findOne({
        guildId: interaction.guild.id,
        generatorChannelId: generador.id
    });

    if (!config) {
        return interaction.editReply({
            content: `❌ El canal ${generador} no es un generador.`
        });
    }

    if (!config.rolesPermisos || config.rolesPermisos.length === 0) {
        return interaction.editReply({
            content: `📋 El generador ${generador} no tiene roles configurados.\n⚠️ Nadie podrá crear canales hasta que configures roles.`
        });
    }

    const embed = new EmbedBuilder()
        .setColor('#0099FF')
        .setTitle(`📋 Roles de ${generador.name}`)
        .setDescription(`Total de roles: **${config.rolesPermisos.length}**`)
        .setTimestamp()
        .setFooter({ text: interaction.guild.name, iconURL: interaction.guild.iconURL() });

    for (const roleData of config.rolesPermisos) {
        const role = interaction.guild.roles.cache.get(roleData.roleId);

        // Agrupar permisos
        const permisosAgrupados = { generales: [], voz: [], texto: [] };

        for (const permiso of roleData.permisos) {
            for (const [cat, perms] of Object.entries(CATEGORIAS_PERMISOS)) {
                const found = perms.find(p => p.value === permiso);
                if (found) {
                    permisosAgrupados[cat].push(`${found.emoji} ${found.name.split(' ').slice(1).join(' ')}`);
                    break;
                }
            }
        }

        let permisosList = '';
        if (permisosAgrupados.generales.length > 0) {
            permisosList += `**Generales:** ${permisosAgrupados.generales.join(', ')}\n`;
        }
        if (permisosAgrupados.voz.length > 0) {
            permisosList += `**Voz:** ${permisosAgrupados.voz.join(', ')}\n`;
        }
        if (permisosAgrupados.texto.length > 0) {
            permisosList += `**Texto:** ${permisosAgrupados.texto.join(', ')}\n`;
        }

        embed.addFields({
            name: `${roleData.puedeCrear ? '✅' : '👁️'} ${role?.name || 'Rol eliminado'}`,
            value: permisosList || 'Sin permisos configurados',
            inline: false
        });
    }

    return interaction.editReply({ embeds: [embed] });
}

/**
 * Limpiar permisos de un rol
 */
async function handleLimpiarRol(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const generador = interaction.options.getChannel('generador');
    const rol = interaction.options.getRole('rol');

    const config = await tempVoiceSchema.findOne({
        guildId: interaction.guild.id,
        generatorChannelId: generador.id
    });

    if (!config) {
        return interaction.editReply({
            content: `❌ El canal ${generador} no es un generador.`
        });
    }

    const roleData = config.rolesPermisos.find(r => r.roleId === rol.id);

    if (!roleData) {
        return interaction.editReply({
            content: `❌ El rol ${rol} no está configurado.`
        });
    }

    const cantidad = roleData.permisos.length;
    roleData.permisos = [];
    await config.save();

    const embed = new EmbedBuilder()
        .setColor('#FFA500')
        .setTitle('🧹 Permisos Limpiados')
        .addFields(
            { name: '🎤 Generador', value: `${generador}`, inline: true },
            { name: '👥 Rol', value: `${rol}`, inline: true },
            { name: '🔐 Permisos Eliminados', value: `${cantidad}`, inline: true }
        )
        .setTimestamp();

    return interaction.editReply({ embeds: [embed] });
}

/**
 * Remover permiso con select menu
 */
async function handleRemoverPermiso(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const generador = interaction.options.getChannel('generador');
    const rol = interaction.options.getRole('rol');

    const config = await tempVoiceSchema.findOne({
        guildId: interaction.guild.id,
        generatorChannelId: generador.id
    });

    if (!config) {
        return interaction.editReply({
            content: `❌ El canal ${generador} no es un generador.`
        });
    }

    const roleData = config.rolesPermisos.find(r => r.roleId === rol.id);

    if (!roleData || roleData.permisos.length === 0) {
        return interaction.editReply({
            content: `❌ El rol ${rol} no tiene permisos para remover.`
        });
    }

    const options = roleData.permisos.map(p => {
        const info = TODOS_PERMISOS.find(perm => perm.value === p);
        return new StringSelectMenuOptionBuilder()
            .setLabel(info?.name || p)
            .setValue(p)
            .setEmoji(info?.emoji || '🔐');
    });

    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId(`tv_remover_${generador.id}_${rol.id}`)
        .setPlaceholder('Selecciona el permiso a remover')
        .addOptions(options);

    const row = new ActionRowBuilder().addComponents(selectMenu);

    const embed = new EmbedBuilder()
        .setColor('#FF0000')
        .setTitle('🗑️ Remover Permiso')
        .setDescription(`Selecciona el permiso a remover del rol ${rol}`)
        .addFields(
            { name: 'Generador', value: `${generador}`, inline: true },
            { name: 'Permisos Actuales', value: `${roleData.permisos.length}`, inline: true }
        );

    await interaction.editReply({ embeds: [embed], components: [row] });
}

/**
 * Múltiples permisos con paginación
 */
async function handleMultiple(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const generador = interaction.options.getChannel('generador');
    const rol = interaction.options.getRole('rol');

    const config = await tempVoiceSchema.findOne({
        guildId: interaction.guild.id,
        generatorChannelId: generador.id
    });

    if (!config) {
        return interaction.editReply({
            content: `❌ El canal ${generador} no es un generador.`
        });
    }

    const roleData = config.rolesPermisos.find(r => r.roleId === rol.id);
    const permisosActuales = roleData?.permisos || [];

    const PERMISOS_POR_PAGINA = 25;
    const totalPaginas = Math.ceil(TODOS_PERMISOS.length / PERMISOS_POR_PAGINA);
    const permisosPagina = TODOS_PERMISOS.slice(0, PERMISOS_POR_PAGINA);

    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId(`tv_multiple_${generador.id}_${rol.id}_0`)
        .setPlaceholder(`Selecciona permisos (Página 1/${totalPaginas})`)
        .setMinValues(0)
        .setMaxValues(permisosPagina.length)
        .addOptions(
            permisosPagina.map(p =>
                new StringSelectMenuOptionBuilder()
                    .setLabel(p.name)
                    .setValue(p.value)
                    .setEmoji(p.emoji)
                    .setDefault(permisosActuales.includes(p.value))
            )
        );

    const row1 = new ActionRowBuilder().addComponents(selectMenu);

    const botones = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`tv_page_${generador.id}_${rol.id}_prev_0`)
            .setLabel('◀ Anterior')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(true),
        new ButtonBuilder()
            .setCustomId(`tv_page_info`)
            .setLabel(`Página 1/${totalPaginas}`)
            .setStyle(ButtonStyle.Primary)
            .setDisabled(true),
        new ButtonBuilder()
            .setCustomId(`tv_page_${generador.id}_${rol.id}_next_0`)
            .setLabel('Siguiente ▶')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(totalPaginas <= 1),
        new ButtonBuilder()
            .setCustomId(`tv_finalizar_${generador.id}_${rol.id}`)
            .setLabel('✅ Finalizar')
            .setStyle(ButtonStyle.Success)
    );

    const embed = new EmbedBuilder()
        .setColor('#0099FF')
        .setTitle('📋 Añadir Múltiples Permisos')
        .setDescription(`Selecciona los permisos para ${rol}`)
        .addFields(
            { name: 'Generador', value: `${generador}`, inline: true },
            { name: 'Permisos Actuales', value: `${permisosActuales.length}`, inline: true }
        )
        .setFooter({ text: '✓ = Permiso actualmente activo' });

    await interaction.editReply({ embeds: [embed], components: [row1, botones] });
}

/**
 * Listar generadores
 */
async function handleListarGeneradores(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const configs = await tempVoiceSchema.find({ guildId: interaction.guild.id });

    if (!configs || configs.length === 0) {
        return interaction.editReply({
            content: '📋 No hay generadores configurados.'
        });
    }

    const embed = new EmbedBuilder()
        .setColor('#0099FF')
        .setTitle('📋 Generadores de Voz Temporal')
        .setDescription(`Total: **${configs.length}**`)
        .setTimestamp()
        .setFooter({ text: interaction.guild.name, iconURL: interaction.guild.iconURL() });

    for (const config of configs) {
        const channel = interaction.guild.channels.cache.get(config.generatorChannelId);
        const category = interaction.guild.channels.cache.get(config.categoryId);

        const rolesCrear = config.rolesPermisos.filter(r => r.puedeCrear).length;
        const rolesTotal = config.rolesPermisos.length;

        embed.addFields({
            name: `🎤 ${channel?.name || 'Canal eliminado'}`,
            value: [
                `**Categoría:** ${category?.name || 'N/A'}`,
                `**Roles:** ${rolesTotal} (${rolesCrear} pueden crear)`,
                `**Canales creados:** ${config.stats?.totalCreated || 0}`
            ].join('\n'),
            inline: true
        });
    }

    await interaction.editReply({ embeds: [embed] });
}

/**
 * Eliminar generador
 */
async function handleEliminarGenerador(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const generador = interaction.options.getChannel('generador');

    const config = await tempVoiceSchema.findOneAndDelete({
        guildId: interaction.guild.id,
        generatorChannelId: generador.id
    });

    if (!config) {
        return interaction.editReply({
            content: `❌ El canal ${generador} no es un generador.`
        });
    }

    const buttons = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`tv_delete_${generador.id}`)
            .setLabel('Eliminar canal también')
            .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
            .setCustomId(`tv_keep`)
            .setLabel('Mantener canal')
            .setStyle(ButtonStyle.Secondary)
    );

    const embed = new EmbedBuilder()
        .setColor('#FFA500')
        .setTitle('🗑️ Generador Eliminado')
        .setDescription(`Configuración eliminada.`)
        .addFields(
            { name: 'Canal', value: `${generador}`, inline: true },
            { name: 'Roles configurados', value: `${config.rolesPermisos.length}`, inline: true }
        )
        .setTimestamp();

    await interaction.editReply({ embeds: [embed], components: [buttons] });
}

/**
 * Configurar generador
 */
async function handleConfigurar(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const generador = interaction.options.getChannel('generador');

    const config = await tempVoiceSchema.findOne({
        guildId: interaction.guild.id,
        generatorChannelId: generador.id
    });

    if (!config) {
        return interaction.editReply({
            content: `❌ El canal ${generador} no es un generador.`
        });
    }

    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId(`tv_config_${generador.id}`)
        .setPlaceholder('Selecciona qué configurar')
        .addOptions(
            new StringSelectMenuOptionBuilder()
                .setLabel('Cambiar nombre de canales')
                .setValue('name')
                .setEmoji('📝'),
            new StringSelectMenuOptionBuilder()
                .setLabel('Cambiar límite de usuarios')
                .setValue('limit')
                .setEmoji('👥'),
            new StringSelectMenuOptionBuilder()
                .setLabel('Cambiar bitrate')
                .setValue('bitrate')
                .setEmoji('🎵'),
            new StringSelectMenuOptionBuilder()
                .setLabel('Canal privado/público')
                .setValue('privacy')
                .setEmoji('🔒')
        );

    const row = new ActionRowBuilder().addComponents(selectMenu);

    const embed = new EmbedBuilder()
        .setColor('#0099FF')
        .setTitle('⚙️ Configurar Generador')
        .addFields(
            { name: '📝 Nombre', value: `\`${config.settings.defaultName}\``, inline: true },
            { name: '👥 Límite', value: config.settings.userLimit === 0 ? 'Sin límite' : `${config.settings.userLimit}`, inline: true },
            { name: '🎵 Bitrate', value: `${config.settings.bitrate / 1000} kbps`, inline: true },
            { name: '🔒 Privado', value: config.settings.privateByDefault ? 'Sí' : 'No', inline: true },
            { name: '👥 Roles', value: `${config.rolesPermisos.length}`, inline: true }
        );

    await interaction.editReply({ embeds: [embed], components: [row] });
}

/**
 * Estadísticas
 */
async function handleStats(interaction, client) {
    await interaction.deferReply({ ephemeral: true });

    const configs = await tempVoiceSchema.find({ guildId: interaction.guild.id });

    let canalesActivos = 0;
    let usuariosEnCanales = 0;
    let totalCreados = 0;

    for (const config of configs) {
        totalCreados += config.stats?.totalCreated || 0;

        const category = interaction.guild.channels.cache.get(config.categoryId);
        if (category) {
            const tempChannels = category.children.cache.filter(ch =>
                ch.type === ChannelType.GuildVoice &&
                ch.id !== config.generatorChannelId
            );
            canalesActivos += tempChannels.size;
            tempChannels.forEach(ch => {
                usuariosEnCanales += ch.members.size;
            });
        }
    }

    const embed = new EmbedBuilder()
        .setColor('#0099FF')
        .setTitle('📊 Estadísticas')
        .addFields(
            { name: '🎤 Generadores', value: `${configs.length}`, inline: true },
            { name: '🔊 Canales Activos', value: `${canalesActivos}`, inline: true },
            { name: '👥 Usuarios', value: `${usuariosEnCanales}`, inline: true },
            { name: '📈 Total Creados', value: `${totalCreados}`, inline: true }
        )
        .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
}

/**
 * Limpiar canales vacíos
 */
async function handleLimpiarCanales(interaction, client) {
    await interaction.deferReply({ ephemeral: true });

    const configs = await tempVoiceSchema.find({ guildId: interaction.guild.id });
    let eliminados = 0;

    for (const config of configs) {
        const category = interaction.guild.channels.cache.get(config.categoryId);
        if (!category) continue;

        const tempChannels = category.children.cache.filter(ch =>
            ch.type === ChannelType.GuildVoice &&
            ch.id !== config.generatorChannelId &&
            ch.members.size === 0
        );

        for (const [, channel] of tempChannels) {
            try {
                await channel.delete('Limpieza manual');
                eliminados++;
            } catch (error) {
                console.error(`Error eliminando ${channel.name}:`, error);
            }
        }
    }

    const embed = new EmbedBuilder()
        .setColor(eliminados > 0 ? '#00FF00' : '#FFA500')
        .setTitle('🧹 Limpieza Completada')
        .setDescription(eliminados > 0
            ? `Se eliminaron **${eliminados}** canales vacíos.`
            : 'No había canales vacíos.')
        .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
}