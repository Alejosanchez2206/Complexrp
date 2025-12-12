const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const UsuarioSancionado = require('../../Models/usuarioSancionado');
const Sancion = require('../../Models/sanciones');
const permisosSchema = require('../../Models/addPermisos');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('historial-sanciones')
        .setDescription('Ver historial completo de sanciones de un usuario')
        .addUserOption(option =>
            option.setName('usuario')
                .setDescription('Usuario de Discord a consultar')
                .setRequired(true)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

    async execute(interaction) {
        try {
            // Validaciones iniciales
            if (!interaction.guild) {
                return interaction.reply({
                    content: '❌ Este comando solo puede usarse en servidores.',
                    ephemeral: true
                });
            }

            await interaction.deferReply({ ephemeral: true });

            console.log(`Comando historial-sanciones ejecutado por: ${interaction.user.tag} (${interaction.user.id})`);

            // Verificar permisos
            const rolesUser = interaction.member.roles.cache.map(role => role.id);
            const validarRol = await permisosSchema.find({
                permiso: 'sanciones',
                guild: interaction.guild.id,
                rol: { $in: rolesUser }
            });

            // Permitir si tiene permisos especiales O permisos de moderación
            const hasPermission = validarRol.length > 0 || 
                                 interaction.member.permissions.has(PermissionFlagsBits.ModerateMembers);

            if (!hasPermission) {
                return interaction.editReply({
                    content: '❌ No tienes permisos para usar este comando.'
                });
            }

            // Obtener usuario
            const usuario = interaction.options.getUser('usuario');

            if (!usuario) {
                return interaction.editReply({
                    content: '❌ Debes proporcionar un usuario válido.'
                });
            }

            // Buscar datos del usuario
            let usuarioData;
            
            try {
                usuarioData = await UsuarioSancionado.findOne({
                    guildId: interaction.guild.id,
                    userId: usuario.id
                }).populate({
                    path: 'sanciones',
                    options: { sort: { createdAt: -1 } }
                });
            } catch (dbError) {
                console.error('Error consultando base de datos:', dbError);
                return interaction.editReply({
                    content: '❌ Error al consultar la base de datos. Por favor, intenta de nuevo.'
                });
            }

            // Si no existe el usuario en la base de datos
            if (!usuarioData) {
                const noHistoryEmbed = new EmbedBuilder()
                    .setColor('#ffa500')
                    .setTitle('📋 Sin Historial de Sanciones')
                    .setDescription(`El usuario ${usuario} no tiene sanciones registradas en este servidor.`)
                    .addFields({
                        name: 'ℹ️ Información',
                        value: 'Este usuario no ha recibido ninguna sanción o aún no está registrado en el sistema.',
                        inline: false
                    })
                    .setThumbnail(usuario.displayAvatarURL({ size: 256 }))
                    .setTimestamp()
                    .setFooter({
                        text: `Consultado por ${interaction.user.tag}`,
                        iconURL: interaction.user.displayAvatarURL()
                    });

                return interaction.editReply({ embeds: [noHistoryEmbed] });
            }

            // Crear embed de historial
            const embed = new EmbedBuilder()
                .setColor('#4dabf7')
                .setTitle('📊 Historial Completo de Sanciones')
                .setDescription(
                    `**Usuario:** ${usuario}\n` +
                    `**Tag:** ${usuarioData.userTag || 'N/A'}\n` +
                    `**Discord ID:** \`${usuario.id}\``
                )
                .setThumbnail(usuario.displayAvatarURL({ size: 256 }))
                .addFields(
                    {
                        name: '📈 Estadísticas Generales',
                        value:
                            `⚠️ Warnings: **${usuarioData.totalWarnings || 0}**\n` +
                            `🚫 Kicks: **${usuarioData.totalKicks || 0}**\n` +
                            `🔨 Bans: **${usuarioData.totalBans || 0}**`,
                        inline: true
                    },
                    {
                        name: '📊 Warnings por Grupo',
                        value:
                            `Grupo 1: **${usuarioData.warningsGrupo1 || 0}/3**\n` +
                            `Grupo 2: **${usuarioData.warningsGrupo2 || 0}/3**\n` +
                            `Grupo 3: **${usuarioData.warningsGrupo3 || 0}/3**`,
                        inline: true
                    }
                );

            // Verificar si tiene sanciones
            if (!usuarioData.sanciones || usuarioData.sanciones.length === 0) {
                embed.addFields({
                    name: '📋 Sanciones',
                    value: 'No tiene sanciones registradas.',
                    inline: false
                });

                embed.setFooter({
                    text: `Consultado por ${interaction.user.tag}`,
                    iconURL: interaction.user.displayAvatarURL()
                });
                embed.setTimestamp();

                return interaction.editReply({ embeds: [embed] });
            }

            // Filtrar sanciones activas
            const sancionesActivas = usuarioData.sanciones
                .filter(s => s && s.activa)
                .sort((a, b) => {
                    const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
                    const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
                    return dateB - dateA;
                });

            const sancionesInactivas = usuarioData.sanciones
                .filter(s => s && !s.activa)
                .length;

            // Agregar sanciones activas al embed
            if (sancionesActivas.length > 0) {
                const sancionesTexto = sancionesActivas.slice(0, 10).map((s, i) => {
                    try {
                        let texto = `**${i + 1}.** ${getTipoEmoji(s.tipo)} **${formatTipo(s.tipo)}**`;
                        
                        // Warning específico
                        if (s.warningGrupo && s.warningNumero) {
                            texto += ` (Grupo ${s.warningGrupo}-${s.warningNumero})`;
                        }
                        
                        // Fecha
                        if (s.createdAt) {
                            const timestamp = Math.floor(new Date(s.createdAt).getTime() / 1000);
                            texto += `\n   📅 <t:${timestamp}:D> (<t:${timestamp}:R>)`;
                        }
                        
                        // Motivos
                        if (s.motivos && Array.isArray(s.motivos) && s.motivos.length > 0) {
                            const motivosTexto = s.motivos.join(', ');
                            const motivosCorto = motivosTexto.length > 80 ? motivosTexto.slice(0, 77) + '...' : motivosTexto;
                            texto += `\n   ⚠️ ${motivosCorto}`;
                        }
                        
                        // Duración para bans
                        if (s.duracionDias) {
                            texto += `\n   ⏱️ ${s.duracionDias} día${s.duracionDias !== 1 ? 's' : ''}`;
                            
                            // Mostrar si ya expiró o fecha de expiración
                            if (s.fechaFin) {
                                const fechaFin = new Date(s.fechaFin);
                                const ahora = new Date();
                                if (fechaFin < ahora) {
                                    texto += ' (Expirado)';
                                } else {
                                    texto += ` - Expira: <t:${Math.floor(fechaFin.getTime() / 1000)}:R>`;
                                }
                            }
                        }
                       
                        // ID de sanción
                        if (s._id) {
                            texto += `\n   🆔 \`${s._id}\``;
                        }
                        
                        return texto;
                    } catch (error) {
                        console.error('Error procesando sanción individual:', error);
                        return `**${i + 1}.** ⚠️ Error al cargar sanción (ID: ${s._id || 'desconocido'})`;
                    }
                }).join('\n\n');

                // Limitar a 1024 caracteres por campo
                const sancionesTextoFinal = sancionesTexto.length > 1024 
                    ? sancionesTexto.slice(0, 1021) + '...' 
                    : sancionesTexto;

                embed.addFields({
                    name: `📋 Sanciones Activas (${sancionesActivas.length})`,
                    value: sancionesTextoFinal,
                    inline: false
                });

                // Nota si hay más de 10 sanciones
                if (sancionesActivas.length > 10) {
                    embed.addFields({
                        name: 'ℹ️ Nota',
                        value: `Mostrando las 10 sanciones más recientes de un total de **${sancionesActivas.length}** sanciones activas.`,
                        inline: false
                    });
                }
            } else {
                embed.addFields({
                    name: '📋 Sanciones Activas',
                    value: 'No tiene sanciones activas en este momento.',
                    inline: false
                });
            }

            // Agregar información sobre sanciones inactivas
            if (sancionesInactivas > 0) {
                embed.addFields({
                    name: '🗃️ Historial Completo',
                    value: `**Total de sanciones:** ${usuarioData.sanciones.length}\n` +
                           `**Sanciones activas:** ${sancionesActivas.length}\n` +
                           `**Sanciones inactivas:** ${sancionesInactivas}`,
                    inline: false
                });
            }

            // Footer y timestamp
            embed.setTimestamp()
                .setFooter({
                    text: `Consultado por ${interaction.user.tag} • User ID: ${usuario.id}`,
                    iconURL: interaction.user.displayAvatarURL()
                });

            await interaction.editReply({ embeds: [embed] });

            console.log(`✅ Historial consultado exitosamente para ${usuario.tag} por ${interaction.user.tag}`);

        } catch (error) {
            console.error('❌ Error en comando historial-sanciones:', error);
            console.error('Stack trace:', error.stack);

            const errorEmbed = new EmbedBuilder()
                .setColor('#ff0000')
                .setTitle('❌ Error al Consultar Historial')
                .setDescription('Ocurrió un error inesperado al obtener el historial de sanciones.')
                .addFields({
                    name: '📝 Detalles del Error',
                    value: `\`\`\`${error.message}\`\`\``,
                    inline: false
                })
                .addFields({
                    name: '💡 Sugerencia',
                    value: 'Si el error persiste, contacta a un administrador del bot.',
                    inline: false
                })
                .setTimestamp()
                .setFooter({
                    text: 'Sistema de Sanciones',
                    iconURL: interaction.client.user.displayAvatarURL()
                });

            try {
                if (interaction.deferred || interaction.replied) {
                    await interaction.editReply({ embeds: [errorEmbed] });
                } else {
                    await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
                }
            } catch (replyError) {
                console.error('❌ Error al responder con mensaje de error:', replyError);
            }
        }
    }
};

/**
 * Obtiene el emoji según el tipo de sanción
 * @param {string} tipo - Tipo de sanción
 * @returns {string} Emoji correspondiente
 */
function getTipoEmoji(tipo) {
    const emojis = {
        warning: '⚠️',
        kick: '🚫',
        ban_temporal: '🔨',
        ban_permanente: '🔒',
        organizacion: '🏢',
        faccion_legal: '⚖️'
    };
    return emojis[tipo] || '📌';
}

/**
 * Formatea el nombre del tipo de sanción
 * @param {string} tipo - Tipo de sanción
 * @returns {string} Nombre formateado
 */
function formatTipo(tipo) {
    const tipos = {
        warning: 'Warning',
        kick: 'Kick',
        ban_temporal: 'Ban Temporal',
        ban_permanente: 'Ban Permanente',
        organizacion: 'Sanción Organización',
        faccion_legal: 'Sanción Facción Legal'
    };
    return tipos[tipo] || tipo.charAt(0).toUpperCase() + tipo.slice(1);
}