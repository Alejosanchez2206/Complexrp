const { Events, EmbedBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const permisosSchema = require('../../Models/addPermisos');

// Importar TODOS_PERMISOS desde el comando
const TODOS_PERMISOS = [
    { name: '📞 Registrar Soporte', value: 'registrar_soporte' },
    { name: '📋 Ver Soportes', value: 'ver_soportes' },
    { name: '✅ Cerrar Soporte', value: 'cerrar_soporte' },
    { name: '📝 Editar Soporte', value: 'editar_soporte' },
    { name: '⚠️ Sanciones', value: 'sanciones' },
    { name: '🔨 Aplicar Sanción', value: 'aplicar_sancion' },
    { name: '📜 Ver Historial Sanciones', value: 'ver_historial_sanciones' },
    { name: '🔓 Remover Sanción', value: 'remover_sancion' },
    { name: '✨ Whitelist', value: 'whitelist' },
    { name: '👀 Revisar Whitelist', value: 'revisar_whitelist' },
    { name: '✔️ Aprobar Whitelist', value: 'aprobar_whitelist' },
    { name: '❌ Rechazar Whitelist', value: 'rechazar_whitelist' },
    { name: '📸 Subir Foto', value: 'subir_foto' },
    { name: '🖼️ Enviar Imagen', value: 'seend_img' },
    { name: '📢 Anunciar', value: 'annunciar' },
    { name: '📰 Crear Anuncio Embed', value: 'crear_anuncio_embed' },
    { name: '🔇 Mutear Usuario', value: 'mutear_usuario' },
    { name: '👢 Kickear Usuario', value: 'kickear_usuario' },
    { name: '🚫 Banear Usuario', value: 'banear_usuario' },
    { name: '🧹 Limpiar Mensajes', value: 'limpiar_mensajes' },
    { name: '📌 Gestionar Tickets', value: 'gestionar_tickets' },
    { name: '⚙️ Server Manager', value: 'serverman' },
    { name: '🔐 Server Only', value: 'serveronly' },
    { name: '👑 Server offline', value: 'serveroffline' },
    { name: '📊 Ver Estadísticas', value: 'ver_estadisticas' },
    { name: '🎮 Gestionar Roles RP', value: 'gestionar_roles_rp' },
    { name: '👥 Gestionar Usuarios', value: 'gestionar_usuarios' },
    { name: '🎭 Gestionar Roles', value: 'gestionar_roles' },
    { name: '📁 Gestionar Canales', value: 'gestionar_canales' },
    { name: '🔧 Configuración Bot', value: 'config_bot' }
];

const PERMISOS_POR_PAGINA = 25;

// Almacenar selecciones temporales por usuario
const seleccionesTemp = new Map();

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction, client) {
        try {
            // ===== MANEJAR SELECT MENUS =====
            if (interaction.isStringSelectMenu()) {

                // MÚLTIPLE - Guardar selección
                if (interaction.customId.startsWith('permisos_multiple_')) {
                    const parts = interaction.customId.split('_');
                    const rolId = parts[2];
                    const paginaActual = parseInt(parts[3]);

                    const userId = interaction.user.id;
                    const key = `${userId}_${rolId}`;

                    // Obtener selecciones previas
                    if (!seleccionesTemp.has(key)) {
                        seleccionesTemp.set(key, new Set());
                    }

                    const selecciones = seleccionesTemp.get(key);

                    // Limpiar selecciones de esta página y añadir las nuevas
                    const inicio = paginaActual * PERMISOS_POR_PAGINA;
                    const fin = inicio + PERMISOS_POR_PAGINA;
                    const permisosEstaPagina = TODOS_PERMISOS.slice(inicio, fin).map(p => p.value);

                    // Remover selecciones antiguas de esta página
                    permisosEstaPagina.forEach(p => selecciones.delete(p));

                    // Añadir nuevas selecciones
                    interaction.values.forEach(v => selecciones.add(v));

                    await interaction.deferUpdate();
                    return;
                }

                // REMOVER
                if (interaction.customId.startsWith('permisos_remover_')) {
                    const rolId = interaction.customId.split('_')[2];
                    const rol = interaction.guild.roles.cache.get(rolId);
                    const permisoARemover = interaction.values[0];

                    const data = await permisosSchema.findOne({
                        guild: interaction.guild.id,
                        rol: rolId
                    });

                    if (data) {
                        data.permisos = data.permisos.filter(p => p !== permisoARemover);
                        await data.save();
                    }

                    const embed = new EmbedBuilder()
                        .setColor('#FF0000')
                        .setTitle('🗑️ Permiso Removido')
                        .setDescription(`Se removió el permiso del rol ${rol}`)
                        .addFields(
                            { name: 'Permiso Removido', value: `\`${permisoARemover}\``, inline: true },
                            { name: 'Permisos Restantes', value: `${data.permisos.length}`, inline: true }
                        )
                        .setTimestamp();

                    await interaction.update({ embeds: [embed], components: [] });
                    return;
                }
            }

            // ===== MANEJAR BOTONES =====
            if (interaction.isButton()) {

                // NAVEGACIÓN DE PÁGINAS
                if (interaction.customId.startsWith('permisos_page_')) {
                    const parts = interaction.customId.split('_');
                    const rolId = parts[2];
                    const accion = parts[3];
                    const paginaActual = parseInt(parts[4]);

                    let nuevaPagina = paginaActual;
                    if (accion === 'prev') nuevaPagina--;
                    if (accion === 'next') nuevaPagina++;

                    const rol = interaction.guild.roles.cache.get(rolId);
                    const data = await permisosSchema.findOne({
                        guild: interaction.guild.id,
                        rol: rolId
                    });

                    const permisosActuales = data?.permisos || [];
                    const userId = interaction.user.id;
                    const key = `${userId}_${rolId}`;
                    const seleccionesUsuario = seleccionesTemp.get(key) || new Set();

                    // Crear nuevo select menu para la nueva página
                    const totalPaginas = Math.ceil(TODOS_PERMISOS.length / PERMISOS_POR_PAGINA);
                    const inicio = nuevaPagina * PERMISOS_POR_PAGINA;
                    const fin = inicio + PERMISOS_POR_PAGINA;
                    const permisosPagina = TODOS_PERMISOS.slice(inicio, fin);

                    const selectMenu = new StringSelectMenuBuilder()
                        .setCustomId(`permisos_multiple_${rolId}_${nuevaPagina}`)
                        .setPlaceholder(`Selecciona permisos (Página ${nuevaPagina + 1}/${totalPaginas})`)
                        .setMinValues(1)
                        .setMaxValues(permisosPagina.length)
                        .addOptions(
                            permisosPagina.map(permiso =>
                                new StringSelectMenuOptionBuilder()
                                    .setLabel(permiso.name)
                                    .setValue(permiso.value)
                                    .setDefault(
                                        permisosActuales.includes(permiso.value) ||
                                        seleccionesUsuario.has(permiso.value)
                                    )
                            )
                        );

                    const row1 = new ActionRowBuilder().addComponents(selectMenu);

                    const botones = new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                            .setCustomId(`permisos_page_${rolId}_prev_${nuevaPagina}`)
                            .setLabel('◀ Anterior')
                            .setStyle(ButtonStyle.Secondary)
                            .setDisabled(nuevaPagina === 0),
                        new ButtonBuilder()
                            .setCustomId(`permisos_page_${rolId}_info`)
                            .setLabel(`Página ${nuevaPagina + 1}/${totalPaginas}`)
                            .setStyle(ButtonStyle.Primary)
                            .setDisabled(true),
                        new ButtonBuilder()
                            .setCustomId(`permisos_page_${rolId}_next_${nuevaPagina}`)
                            .setLabel('Siguiente ▶')
                            .setStyle(ButtonStyle.Secondary)
                            .setDisabled(nuevaPagina >= totalPaginas - 1),
                        new ButtonBuilder()
                            .setCustomId(`permisos_multiple_finalizar_${rolId}`)
                            .setLabel('✅ Finalizar')
                            .setStyle(ButtonStyle.Success)
                    );

                    const embed = new EmbedBuilder()
                        .setColor('#0099FF')
                        .setTitle('📋 Añadir Múltiples Permisos')
                        .setDescription(`Selecciona los permisos que deseas añadir al rol ${rol}\n\n**Instrucciones:**\n• Selecciona los permisos de esta página\n• Usa los botones para navegar entre páginas\n• Presiona "✅ Finalizar" cuando termines`)
                        .addFields(
                            { name: 'Rol', value: `${rol}`, inline: true },
                            { name: 'Permisos Actuales', value: `${permisosActuales.length}`, inline: true },
                            { name: 'Página', value: `${nuevaPagina + 1} de ${totalPaginas}`, inline: true },
                            { name: 'Seleccionados', value: `${seleccionesUsuario.size}`, inline: true }
                        )
                        .setFooter({ text: 'Los permisos marcados ya están activos o seleccionados' });

                    await interaction.update({ embeds: [embed], components: [row1, botones] });
                    return;
                }

                // FINALIZAR SELECCIÓN MÚLTIPLE
                if (interaction.customId.startsWith('permisos_multiple_finalizar_')) {
                    const rolId = interaction.customId.split('_')[3];
                    const rol = interaction.guild.roles.cache.get(rolId);

                    const userId = interaction.user.id;
                    const key = `${userId}_${rolId}`;
                    const seleccionesUsuario = seleccionesTemp.get(key) || new Set();

                    if (seleccionesUsuario.size === 0) {
                        return interaction.reply({
                            content: '⚠️ No has seleccionado ningún permiso',
                            ephemeral: true
                        });
                    }

                    const permisosSeleccionados = Array.from(seleccionesUsuario);

                    const data = await permisosSchema.findOne({
                        guild: interaction.guild.id,
                        rol: rolId
                    });

                    let permisosAñadidos = [];

                    if (data) {
                        permisosSeleccionados.forEach(permiso => {
                            if (!data.permisos.includes(permiso)) {
                                permisosAñadidos.push(permiso);
                            }
                        });

                        if (permisosAñadidos.length > 0) {
                            data.permisos.push(...permisosAñadidos);
                            data.updatedAt = new Date();
                            await data.save();
                        }
                    } else {
                        const newData = new permisosSchema({
                            guild: interaction.guild.id,
                            rol: rolId,
                            permisos: permisosSeleccionados
                        });
                        await newData.save();
                        permisosAñadidos = permisosSeleccionados;
                    }

                    // Limpiar selecciones temporales
                    seleccionesTemp.delete(key);

                    const embed = new EmbedBuilder()
                        .setColor(permisosAñadidos.length > 0 ? '#00FF00' : '#FFA500')
                        .setTitle(permisosAñadidos.length > 0 ? '✅ Permisos Añadidos' : '⚠️ Sin Cambios')
                        .setDescription(
                            permisosAñadidos.length > 0
                                ? `Se añadieron **${permisosAñadidos.length}** permisos nuevos al rol ${rol}`
                                : `El rol ${rol} ya tenía todos los permisos seleccionados`
                        )
                        .setTimestamp()
                        .setFooter({ text: `Por ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() });

                    if (permisosAñadidos.length > 0) {
                        const permisosTexto = permisosAñadidos.map(p => `• \`${p}\``).join('\n');
                        embed.addFields({
                            name: '📝 Permisos Añadidos',
                            value: permisosTexto.length > 1024
                                ? permisosTexto.substring(0, 1021) + '...'
                                : permisosTexto,
                            inline: false
                        });
                    }

                    const totalPermisos = data ? data.permisos.length : permisosSeleccionados.length;
                    embed.addFields({
                        name: '📊 Total de Permisos',
                        value: `El rol ahora tiene **${totalPermisos}** permisos configurados`,
                        inline: false
                    });

                    await interaction.update({ embeds: [embed], components: [] });
                    return;
                }
            }

        } catch (error) {
            console.error('Error en permisos interaction:', error);

            try {
                if (!interaction.replied && !interaction.deferred) {
                    await interaction.reply({
                        content: '❌ Ocurrió un error al procesar la interacción',
                        ephemeral: true
                    });
                }
            } catch (e) {
                console.error('Error al enviar mensaje de error:', e);
            }
        }
    }
};