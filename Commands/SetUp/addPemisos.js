const {
    SlashCommandBuilder,
    Client,
    PermissionFlagsBits,
    ChatInputCommandInteraction,
    EmbedBuilder
} = require('discord.js');

const permisosSchema = require('../../Models/addPermisos');
const permisosEspecialSchema = require('../../Models/permisosEspecial');

// Organizar permisos por categorías
const CATEGORIAS_PERMISOS = {
    soporte: [
        { name: '📞 Registrar Soporte', value: 'registrar_soporte' },
        { name: '📋 Ver Soportes', value: 'ver_soportes' },
        { name: '✅ Cerrar Soporte', value: 'cerrar_soporte' },
        { name: '📝 Editar Soporte', value: 'editar_soporte' },
    ],
    sanciones: [
        { name: '⚠️ Sanciones', value: 'sanciones' },
        { name: '🔨 Aplicar Sanción', value: 'aplicar_sancion' },
        { name: '📜 Ver Historial Sanciones', value: 'ver_historial_sanciones' },
        { name: '🔓 Remover Sanción', value: 'remover_sancion' },
    ],
    whitelist: [
        { name: '✨ Whitelist', value: 'whitelist' },
        { name: '👀 Revisar Whitelist', value: 'revisar_whitelist' },
        { name: '✔️ Aprobar Whitelist', value: 'aprobar_whitelist' },
        { name: '❌ Rechazar Whitelist', value: 'rechazar_whitelist' },
    ],
    contenido: [
        { name: '📸 Subir Foto', value: 'subir_foto' },
        { name: '🖼️ Enviar Imagen', value: 'seend_img' },
        { name: '📢 Anunciar', value: 'annunciar' },
        { name: '📰 Crear Anuncio Embed', value: 'crear_anuncio_embed' },
        { name: '🎥 Encargados de streamer ', value: 'encargados_streamer' },
    ],
    moderacion: [
        { name: '🔇 Mutear Usuario', value: 'mutear_usuario' },
        { name: '👢 Kickear Usuario', value: 'kickear_usuario' },
        { name: '🚫 Banear Usuario', value: 'banear_usuario' },
        { name: '🧹 Limpiar Mensajes', value: 'limpiar_mensajes' },
        { name: '📌 Gestionar Tickets', value: 'gestionar_tickets' },
    ],
    servidor: [
        { name: '⚙️ Server Manager', value: 'serverman' },
        { name: '🔐 Server Only', value: 'serveronly' },
        { name: '👑 Owner offline', value: 'serveroffline' },
        { name: '📊 Ver Estadísticas', value: 'ver_estadisticas' },
        { name: '🎮 Gestionar Roles RP', value: 'gestionar_roles_rp' },
    ],
    administracion: [
        { name: '👥 Gestionar Usuarios', value: 'gestionar_usuarios' },
        { name: '🎭 Gestionar Roles', value: 'gestionar_roles' },
        { name: '📁 Gestionar Canales', value: 'gestionar_canales' },
        { name: '🔧 Configuración Bot', value: 'config_bot' },
    ]
};

// Todos los permisos en un solo array (para búsquedas)
const TODOS_PERMISOS = Object.values(CATEGORIAS_PERMISOS).flat();

module.exports = {
    data: new SlashCommandBuilder()
        .setName('add-permisos')
        .setDescription('Gestiona permisos del servidor')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)

        // ===== AÑADIR CON CATEGORÍAS =====
        .addSubcommandGroup(group =>
            group
                .setName('añadir')
                .setDescription('Añade permisos a un rol')
                .addSubcommand(sub =>
                    sub
                        .setName('soporte')
                        .setDescription('Permisos de soporte')
                        .addRoleOption(opt => opt.setName('rol').setDescription('Rol').setRequired(true))
                        .addStringOption(opt =>
                            opt.setName('permiso')
                                .setDescription('Permiso a añadir')
                                .setRequired(true)
                                .addChoices(...CATEGORIAS_PERMISOS.soporte)
                        )
                )
                .addSubcommand(sub =>
                    sub
                        .setName('sanciones')
                        .setDescription('Permisos de sanciones')
                        .addRoleOption(opt => opt.setName('rol').setDescription('Rol').setRequired(true))
                        .addStringOption(opt =>
                            opt.setName('permiso')
                                .setDescription('Permiso a añadir')
                                .setRequired(true)
                                .addChoices(...CATEGORIAS_PERMISOS.sanciones)
                        )
                )
                .addSubcommand(sub =>
                    sub
                        .setName('whitelist')
                        .setDescription('Permisos de whitelist')
                        .addRoleOption(opt => opt.setName('rol').setDescription('Rol').setRequired(true))
                        .addStringOption(opt =>
                            opt.setName('permiso')
                                .setDescription('Permiso a añadir')
                                .setRequired(true)
                                .addChoices(...CATEGORIAS_PERMISOS.whitelist)
                        )
                )
                .addSubcommand(sub =>
                    sub
                        .setName('contenido')
                        .setDescription('Permisos de contenido')
                        .addRoleOption(opt => opt.setName('rol').setDescription('Rol').setRequired(true))
                        .addStringOption(opt =>
                            opt.setName('permiso')
                                .setDescription('Permiso a añadir')
                                .setRequired(true)
                                .addChoices(...CATEGORIAS_PERMISOS.contenido)
                        )
                )
                .addSubcommand(sub =>
                    sub
                        .setName('moderacion')
                        .setDescription('Permisos de moderación')
                        .addRoleOption(opt => opt.setName('rol').setDescription('Rol').setRequired(true))
                        .addStringOption(opt =>
                            opt.setName('permiso')
                                .setDescription('Permiso a añadir')
                                .setRequired(true)
                                .addChoices(...CATEGORIAS_PERMISOS.moderacion)
                        )
                )
                .addSubcommand(sub =>
                    sub
                        .setName('servidor')
                        .setDescription('Permisos de servidor')
                        .addRoleOption(opt => opt.setName('rol').setDescription('Rol').setRequired(true))
                        .addStringOption(opt =>
                            opt.setName('permiso')
                                .setDescription('Permiso a añadir')
                                .setRequired(true)
                                .addChoices(...CATEGORIAS_PERMISOS.servidor)
                        )
                )
                .addSubcommand(sub =>
                    sub
                        .setName('administracion')
                        .setDescription('Permisos de administración')
                        .addRoleOption(opt => opt.setName('rol').setDescription('Rol').setRequired(true))
                        .addStringOption(opt =>
                            opt.setName('permiso')
                                .setDescription('Permiso a añadir')
                                .setRequired(true)
                                .addChoices(...CATEGORIAS_PERMISOS.administracion)
                        )
                )
        )

        // ===== REMOVER =====
        .addSubcommand(subcommand =>
            subcommand
                .setName('remover')
                .setDescription('Remueve un permiso (usa select menu)')
                .addRoleOption(option =>
                    option.setName('rol')
                        .setDescription('Rol del que remover el permiso')
                        .setRequired(true)
                )
        )

        // ===== LISTAR =====
        .addSubcommand(subcommand =>
            subcommand
                .setName('listar')
                .setDescription('Lista todos los permisos de un rol')
                .addRoleOption(option =>
                    option.setName('rol')
                        .setDescription('Rol a consultar')
                        .setRequired(true)
                )
        )

        // ===== MÚLTIPLE =====
        .addSubcommand(subcommand =>
            subcommand
                .setName('multiple')
                .setDescription('Añade múltiples permisos a un rol')
                .addRoleOption(option =>
                    option.setName('rol')
                        .setDescription('Rol al que añadir permisos')
                        .setRequired(true)
                )
        )

        // ===== LIMPIAR =====
        .addSubcommand(subcommand =>
            subcommand
                .setName('limpiar')
                .setDescription('Limpia todos los permisos de un rol')
                .addRoleOption(option =>
                    option.setName('rol')
                        .setDescription('Rol a limpiar')
                        .setRequired(true)
                )
        ),

    async execute(interaction, client) {
        try {
            if (!interaction.guild) return;
            if (!interaction.isChatInputCommand()) return;

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

            // Si es un grupo de añadir
            if (subcommandGroup === 'añadir') {
                await handleAñadir(interaction);
            } else {
                // Otros subcomandos
                switch (subcommand) {
                    case 'remover':
                        await handleRemover(interaction);
                        break;
                    case 'listar':
                        await handleListar(interaction);
                        break;
                    case 'multiple':
                        await handleMultiple(interaction);
                        break;
                    case 'limpiar':
                        await handleLimpiar(interaction);
                        break;
                    default:
                        await interaction.reply({
                            content: '❌ Subcomando no válido',
                            ephemeral: true
                        });
                }
            }

        } catch (error) {
            console.error('Error en add-permisos:', error);

            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({
                    content: `❌ Ocurrió un error: ${error.message}`,
                    ephemeral: true
                });
            } else {
                await interaction.followUp({
                    content: `❌ Ocurrió un error: ${error.message}`,
                    ephemeral: true
                });
            }
        }
    }
}

// ==================== FUNCIONES AUXILIARES ====================

async function handleAñadir(interaction) {
    const rol = interaction.options.getRole('rol');
    const permiso = interaction.options.getString('permiso');

    let data = await permisosSchema.findOne({
        guild: interaction.guild.id,
        rol: rol.id
    });

    if (data) {
        if (data.permisos && data.permisos.includes(permiso)) {
            return interaction.reply({
                content: `⚠️ El rol ${rol} ya tiene el permiso **${permiso}**`,
                ephemeral: true
            });
        }

        if (!data.permisos) data.permisos = [];
        data.permisos.push(permiso);
        await data.save();

        const embed = new EmbedBuilder()
            .setColor('#00FF00')
            .setTitle('✅ Permiso Añadido')
            .setDescription(`Se añadió el permiso **${permiso}** al rol ${rol}`)
            .addFields(
                { name: 'Rol', value: `${rol}`, inline: true },
                { name: 'Permiso', value: `\`${permiso}\``, inline: true },
                { name: 'Total Permisos', value: `${data.permisos.length}`, inline: true }
            )
            .setTimestamp()
            .setFooter({ text: `Por ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() });

        return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    const newData = new permisosSchema({
        guild: interaction.guild.id,
        rol: rol.id,
        permisos: [permiso]
    });
    await newData.save();

    const embed = new EmbedBuilder()
        .setColor('#00FF00')
        .setTitle('✅ Permisos Creados')
        .setDescription(`Se creó el registro de permisos para ${rol}`)
        .addFields(
            { name: 'Rol', value: `${rol}`, inline: true },
            { name: 'Primer Permiso', value: `\`${permiso}\``, inline: true }
        )
        .setTimestamp()
        .setFooter({ text: `Por ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() });

    return interaction.reply({ embeds: [embed], ephemeral: true });
}

async function handleRemover(interaction) {
    const { StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ActionRowBuilder } = require('discord.js');

    const rol = interaction.options.getRole('rol');

    const data = await permisosSchema.findOne({
        guild: interaction.guild.id,
        rol: rol.id
    });

    if (!data || !data.permisos || data.permisos.length === 0) {
        return interaction.reply({
            content: `❌ El rol ${rol} no tiene permisos registrados`,
            ephemeral: true
        });
    }

    // Crear select menu con los permisos que tiene el rol
    const permisoInfo = data.permisos.map(p => {
        const info = TODOS_PERMISOS.find(perm => perm.value === p);
        return info || { name: p, value: p };
    });

    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId(`permisos_remover_${rol.id}`)
        .setPlaceholder('Selecciona el permiso a remover')
        .setMinValues(1)
        .setMaxValues(1)
        .addOptions(
            permisoInfo.map(permiso =>
                new StringSelectMenuOptionBuilder()
                    .setLabel(permiso.name)
                    .setValue(permiso.value)
            )
        );

    const row = new ActionRowBuilder().addComponents(selectMenu);

    const embed = new EmbedBuilder()
        .setColor('#FF0000')
        .setTitle('🗑️ Remover Permiso')
        .setDescription(`Selecciona el permiso que deseas remover del rol ${rol}`)
        .addFields(
            { name: 'Rol', value: `${rol}`, inline: true },
            { name: 'Permisos Actuales', value: `${data.permisos.length}`, inline: true }
        );

    await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
}

async function handleListar(interaction) {
    const rol = interaction.options.getRole('rol');

    const data = await permisosSchema.findOne({
        guild: interaction.guild.id,
        rol: rol.id
    });

    if (!data || !data.permisos || data.permisos.length === 0) {
        return interaction.reply({
            content: `📋 El rol ${rol} no tiene permisos registrados`,
            ephemeral: true
        });
    }

    const categorias = {
        '📞 Soporte': [],
        '⚠️ Sanciones': [],
        '✨ Whitelist': [],
        '📸 Contenido': [],
        '🛡️ Moderación': [],
        '⚙️ Servidor': [],
        '👥 Administración': []
    };

    data.permisos.forEach(permiso => {
        if (permiso.includes('soporte')) categorias['📞 Soporte'].push(permiso);
        else if (permiso.includes('sancion')) categorias['⚠️ Sanciones'].push(permiso);
        else if (permiso.includes('whitelist')) categorias['✨ Whitelist'].push(permiso);
        else if (permiso.includes('foto') || permiso.includes('img') || permiso.includes('anunc')) categorias['📸 Contenido'].push(permiso);
        else if (permiso.includes('mutear') || permiso.includes('kick') || permiso.includes('ban') || permiso.includes('ticket')) categorias['🛡️ Moderación'].push(permiso);
        else if (permiso.includes('server')) categorias['⚙️ Servidor'].push(permiso);
        else categorias['👥 Administración'].push(permiso);
    });

    const embed = new EmbedBuilder()
        .setColor('#0099FF')
        .setTitle(`📋 Permisos de ${rol.name}`)
        .setDescription(`Total de permisos: **${data.permisos.length}**`)
        .setTimestamp()
        .setFooter({ text: interaction.guild.name, iconURL: interaction.guild.iconURL() });

    Object.entries(categorias).forEach(([categoria, permisos]) => {
        if (permisos.length > 0) {
            embed.addFields({
                name: categoria,
                value: permisos.map(p => `• \`${p}\``).join('\n'),
                inline: false
            });
        }
    });

    return interaction.reply({ embeds: [embed], ephemeral: true });
}

/**
 * Añade múltiples permisos mediante selección con paginación
 */
async function handleMultiple(interaction) {
    const { StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

    const rol = interaction.options.getRole('rol');

    const data = await permisosSchema.findOne({
        guild: interaction.guild.id,
        rol: rol.id
    });

    const permisosActuales = data?.permisos || [];

    // Dividir permisos en grupos de 25 (límite de Discord)
    const PERMISOS_POR_PAGINA = 25;
    const totalPaginas = Math.ceil(TODOS_PERMISOS.length / PERMISOS_POR_PAGINA);

    // Crear select menu para la primera página
    const paginaActual = 0;
    const inicio = paginaActual * PERMISOS_POR_PAGINA;
    const fin = inicio + PERMISOS_POR_PAGINA;
    const permisosPagina = TODOS_PERMISOS.slice(inicio, fin);

    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId(`permisos_multiple_${rol.id}_${paginaActual}`)
        .setPlaceholder(`Selecciona permisos (Página ${paginaActual + 1}/${totalPaginas})`)
        .setMinValues(1)
        .setMaxValues(permisosPagina.length)
        .addOptions(
            permisosPagina.map(permiso =>
                new StringSelectMenuOptionBuilder()
                    .setLabel(permiso.name)
                    .setValue(permiso.value)
                    .setDefault(permisosActuales.includes(permiso.value))
            )
        );

    const row1 = new ActionRowBuilder().addComponents(selectMenu);

    // Crear botones de navegación solo si hay más de una página
    const components = [row1];

    if (totalPaginas > 1) {
        const botones = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`permisos_page_${rol.id}_prev_${paginaActual}`)
                .setLabel('◀ Anterior')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(paginaActual === 0),
            new ButtonBuilder()
                .setCustomId(`permisos_page_${rol.id}_info`)
                .setLabel(`Página ${paginaActual + 1}/${totalPaginas}`)
                .setStyle(ButtonStyle.Primary)
                .setDisabled(true),
            new ButtonBuilder()
                .setCustomId(`permisos_page_${rol.id}_next_${paginaActual}`)
                .setLabel('Siguiente ▶')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(paginaActual >= totalPaginas - 1),
            new ButtonBuilder()
                .setCustomId(`permisos_multiple_finalizar_${rol.id}`)
                .setLabel('✅ Finalizar')
                .setStyle(ButtonStyle.Success)
        );
        components.push(botones);
    }

    const embed = new EmbedBuilder()
        .setColor('#0099FF')
        .setTitle('📋 Añadir Múltiples Permisos')
        .setDescription(`Selecciona los permisos que deseas añadir al rol ${rol}\n\n**Instrucciones:**\n• Selecciona los permisos de esta página\n• Usa los botones para navegar entre páginas\n• Presiona "✅ Finalizar" cuando termines`)
        .addFields(
            { name: 'Rol', value: `${rol}`, inline: true },
            { name: 'Permisos Actuales', value: `${permisosActuales.length}`, inline: true },
            { name: 'Página', value: `${paginaActual + 1} de ${totalPaginas}`, inline: true }
        )
        .setFooter({ text: 'Los permisos marcados ya están activos' });

    await interaction.reply({ embeds: [embed], components, ephemeral: true });
}

async function handleLimpiar(interaction) {
    const rol = interaction.options.getRole('rol');

    const data = await permisosSchema.findOne({
        guild: interaction.guild.id,
        rol: rol.id
    });

    if (!data || !data.permisos || data.permisos.length === 0) {
        return interaction.reply({
            content: `❌ El rol ${rol} no tiene permisos para limpiar`,
            ephemeral: true
        });
    }

    const cantidadPermisos = data.permisos.length;

    data.permisos = [];
    await data.save();

    const embed = new EmbedBuilder()
        .setColor('#FFA500')
        .setTitle('🧹 Permisos Limpiados')
        .setDescription(`Se limpiaron todos los permisos del rol ${rol}`)
        .addFields(
            { name: 'Rol', value: `${rol}`, inline: true },
            { name: 'Permisos Eliminados', value: `${cantidadPermisos}`, inline: true }
        )
        .setTimestamp()
        .setFooter({ text: `Por ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() });

    return interaction.reply({ embeds: [embed], ephemeral: true });
}