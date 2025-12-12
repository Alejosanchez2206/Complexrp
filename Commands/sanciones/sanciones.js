const {
    SlashCommandBuilder,
    Client,
    ChatInputCommandInteraction,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} = require('discord.js');

const permisosSchema = require('../../Models/addPermisos');
const Sancion = require('../../Models/sanciones');
const UsuarioSancionado = require('../../Models/usuarioSancionado');
const config = require('../../config.json');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('sanciones')
        .setDescription('Registra y notifica una sanción aplicada')
        // OPCIONES REQUERIDAS PRIMERO
        .addStringOption(option => option
            .setName('tipo')
            .setDescription('Tipo de sanción a aplicar')
            .setRequired(true)
            .addChoices(
                { name: '⚠️ Warning', value: 'warning' },
                { name: '🚫 Kick', value: 'kick' },
                { name: '🔨 Ban Temporal', value: 'ban_temporal' },
                { name: '🔒 Ban Permanente', value: 'ban_permanente' },
                { name: '🏢 Sanción a Organización', value: 'organizacion' },
                { name: '⚖️ Sanción a Facción Legal', value: 'faccion_legal' }
            )
        )
        .addStringOption(option => option
            .setName('motivos')
            .setDescription('Motivos de la sanción separados por comas (ej: metagaming, nvl, vdm)')
            .setRequired(true)
        )
        .addStringOption(option => option
            .setName('descripcion')
            .setDescription('Descripción detallada de la situación')
            .setRequired(true)
        )
        // OPCIONES NO REQUERIDAS DESPUÉS
        .addUserOption(option =>
            option.setName('usuario')
                .setDescription('Usuario de Discord sancionado (requerido para sanciones individuales)')
                .setRequired(false)
        )
        .addStringOption(option => option
            .setName('organizacion')
            .setDescription('Nombre de la organización o facción (requerido para sanciones grupales)')
            .setRequired(false)
        )
        .addStringOption(option => option
            .setName('evidencia')
            .setDescription('Enlaces a evidencias (screenshots, videos, etc.)')
            .setRequired(false)
        )
        .addIntegerOption(option => option
            .setName('duracion_dias')
            .setDescription('Duración del ban en días (requerido para bans temporales)')
            .setMinValue(1)
            .setMaxValue(365)
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

            await interaction.deferReply({ ephemeral: true });

            console.log(`Comando sanciones ejecutado por: ${interaction.user.tag} (${interaction.user.id})`);

            // Verificar permisos
            const rolesUser = interaction.member.roles.cache.map(role => role.id);
            const validarRol = await permisosSchema.find({
                permiso: 'sanciones',
                guild: interaction.guild.id,
                rol: { $in: rolesUser }
            });

            if (validarRol.length === 0) {
                return interaction.editReply({
                    content: '❌ No tienes permisos para usar este comando.'
                });
            }

            // Obtener opciones
            const tipoSancion = interaction.options.getString('tipo');
            const motivosString = interaction.options.getString('motivos');
            const descripcion = interaction.options.getString('descripcion');
            const usuario = interaction.options.getUser('usuario');
            const organizacion = interaction.options.getString('organizacion');
            const evidencia = interaction.options.getString('evidencia') || 'N/A';
            const duracionDias = interaction.options.getInteger('duracion_dias');

            // Validaciones según tipo
            const esIndividual = ['warning', 'kick', 'ban_temporal', 'ban_permanente'].includes(tipoSancion);
            const esGrupal = ['organizacion', 'faccion_legal'].includes(tipoSancion);

            if (esIndividual && !usuario) {
                return interaction.editReply({
                    content: '❌ Debes mencionar al usuario de Discord para sanciones individuales.'
                });
            }

            if (esGrupal && !organizacion) {
                return interaction.editReply({
                    content: '❌ Debes proporcionar el nombre de la organización/facción para sanciones grupales.'
                });
            }

            if (tipoSancion === 'ban_temporal' && !duracionDias) {
                return interaction.editReply({
                    content: '❌ Para bans temporales debes especificar la duración en días.'
                });
            }

            // Procesar motivos
            const motivos = motivosString.split(',').map(m => m.trim()).filter(m => m);

            // Variables para warnings
            let warningGrupo = null;
            let warningNumero = null;
            let usuarioData = null;

            // Si es warning, calcular grupo y número automáticamente
            if (tipoSancion === 'warning' && usuario) {
                // Buscar o crear datos del usuario
                usuarioData = await UsuarioSancionado.findOne({
                    guildId: interaction.guild.id,
                    userId: usuario.id
                });

                if (!usuarioData) {
                    usuarioData = await UsuarioSancionado.create({
                        guildId: interaction.guild.id,
                        userId: usuario.id,
                        userTag: usuario.tag,
                        totalWarnings: 0,
                        warningsGrupo1: 0,
                        warningsGrupo2: 0,
                        warningsGrupo3: 0
                    });
                }

                // Calcular en qué grupo va el warning
                if (usuarioData.warningsGrupo1 < 3) {
                    warningGrupo = 1;
                    warningNumero = usuarioData.warningsGrupo1 + 1;
                } else if (usuarioData.warningsGrupo2 < 3) {
                    warningGrupo = 2;
                    warningNumero = usuarioData.warningsGrupo2 + 1;
                } else if (usuarioData.warningsGrupo3 < 3) {
                    warningGrupo = 3;
                    warningNumero = usuarioData.warningsGrupo3 + 1;
                } else {
                    // Ya tiene 9 warnings
                    return interaction.editReply({
                        content: '⚠️ Este usuario ya tiene 9 warnings (3 grupos completos). Se recomienda aplicar un ban permanente.'
                    });
                }
            } else if (esIndividual && usuario) {
                // Para otras sanciones individuales, buscar o crear usuario
                usuarioData = await UsuarioSancionado.findOne({
                    guildId: interaction.guild.id,
                    userId: usuario.id
                });

                if (!usuarioData) {
                    usuarioData = await UsuarioSancionado.create({
                        guildId: interaction.guild.id,
                        userId: usuario.id,
                        userTag: usuario.tag
                    });
                }
            }

            // Calcular fechas para bans temporales
            let fechaFin = null;
            if (tipoSancion === 'ban_temporal' && duracionDias) {
                fechaFin = new Date(Date.now() + duracionDias * 24 * 60 * 60 * 1000);
            }

            // Verificar canales
            const canalDestinoId = config.ChannelSanciones;
            const canalDestino = client.channels.cache.get(canalDestinoId);

            if (!canalDestino) {
                return interaction.editReply({
                    content: '❌ Canal de sanciones no encontrado. Contacta a un administrador.'
                });
            }

            if (!canalDestino.permissionsFor(interaction.guild.members.me).has(['SendMessages', 'ViewChannel'])) {
                return interaction.editReply({
                    content: '❌ No tengo permisos para enviar mensajes en el canal de sanciones.'
                });
            }

            // Crear embed de sanción
            const embedConfig = getEmbedConfig(tipoSancion);
            const sancionEmbed = new EmbedBuilder()
                .setColor(embedConfig.color)
                .setTitle(embedConfig.titulo)
                .setTimestamp()               

            // Campos según tipo
            if (esIndividual) {
                let jugadorInfo = `${usuario}\nDiscord: <@${usuario.id}>`;

                sancionEmbed.addFields({
                    name: '👤 Jugador',
                    value: jugadorInfo,
                    inline: false
                });

                // Warning específico
                if (tipoSancion === 'warning') {
                    sancionEmbed.addFields({
                        name: '📊 Grupo',
                        value: `Grupo ${warningGrupo} - Warning ${warningNumero}/3`,
                        inline: true
                    });
                }

                // Ban temporal
                if (tipoSancion === 'ban_temporal') {
                    sancionEmbed.addFields({
                        name: '⏱️ Duración',
                        value: `${duracionDias} día(s)\nFinaliza: <t:${Math.floor(fechaFin.getTime() / 1000)}:F>`,
                        inline: true
                    });
                }
            } else {
                sancionEmbed.addFields({
                    name: embedConfig.nombreCampo,
                    value: `**${organizacion}**`,
                    inline: false
                });
            }

            // Campos comunes
            sancionEmbed.addFields(
                {
                    name: '⚠️ Motivos',
                    value: motivos.join(', '),
                    inline: false
                },
                {
                    name: '📝 Mensaje',
                    value: descripcion.length > 1024 ? `${descripcion.slice(0, 1021)}...` : descripcion,
                    inline: false
                },
                {
                    name: '📎 Evidencia',
                    value: evidencia,
                    inline: false
                }
            );

            // Enviar mensaje
            const mensajeEnviado = await canalDestino.send({
                content: embedConfig.mencion,
                embeds: [sancionEmbed]
            });

            console.log(`Mensaje de sanción enviado: ${mensajeEnviado.id}`);

            // Guardar en base de datos
            const sancionGuardada = await Sancion.create({
                guildId: interaction.guild.id,
                userId: usuario?.id || "N/A",
                userTag: usuario?.tag || "N/A",
                tipo: tipoSancion,
                organizacion: organizacion || null,
                motivos,
                descripcion,
                evidencia,
                warningGrupo,
                warningNumero,
                duracionDias: duracionDias || null,
                fechaFin: fechaFin || null,
                staffId: interaction.user.id,
                staffTag: interaction.user.tag,
                messageId: mensajeEnviado.id,
                channelId: canalDestino.id,
                activa: true
            });

            console.log(`Sanción guardada en BD: ${sancionGuardada._id}`);

            // Actualizar estadísticas del usuario si es individual
            if (esIndividual && usuarioData) {
                if (tipoSancion === 'warning') {
                    usuarioData.totalWarnings += 1;
                    usuarioData[`warningsGrupo${warningGrupo}`] += 1;
                } else if (tipoSancion === 'kick') {
                    usuarioData.totalKicks += 1;
                } else if (tipoSancion === 'ban_temporal' || tipoSancion === 'ban_permanente') {
                    usuarioData.totalBans += 1;
                }

                usuarioData.sanciones.push(sancionGuardada._id);
                usuarioData.userTag = usuario.tag; // Actualizar tag por si cambió
                usuarioData.updatedAt = Date.now();
                await usuarioData.save();

                console.log(`Estadísticas actualizadas para usuario: ${usuario.tag}`);
            }

            // Log
            await enviarLog(interaction, client, {
                sancionGuardada,
                usuarioData,
                mensajeEnviado,
                canalDestino,
                embedConfig,
                usuario
            });

            // Respuesta de confirmación
            const confirmEmbed = new EmbedBuilder()
                .setColor('#00ff00')
                .setTitle('✅ Sanción Aplicada Exitosamente')
                .addFields(
                    {
                        name: '📂 Tipo',
                        value: embedConfig.titulo,
                        inline: true
                    },
                    {
                        name: '🎯 Objetivo',
                        value: usuario ? `${usuario.tag} (<@${usuario.id}>)` : organizacion,
                        inline: true
                    },
                    {
                        name: '🆔 ID Sanción',
                        value: `\`${sancionGuardada._id}\``,
                        inline: false
                    }
                );

            if (warningGrupo) {
                confirmEmbed.addFields({
                    name: '📊 Warning Registrado',
                    value: `Grupo ${warningGrupo} - Warning ${warningNumero}/3\nTotal acumulado: ${usuarioData.totalWarnings}`,
                    inline: false
                });

                // Avisar si está cerca de completar un grupo
                if (warningNumero === 2) {
                    confirmEmbed.addFields({
                        name: '⚠️ Advertencia',
                        value: `El usuario está a **1 warning** de completar el Grupo ${warningGrupo}.`,
                        inline: false
                    });
                } else if (warningNumero === 3) {
                    confirmEmbed.addFields({
                        name: '🚨 Grupo Completado',
                        value: `El usuario ha completado el **Grupo ${warningGrupo}**. Se recomienda aplicar un ban temporal de 7 días.`,
                        inline: false
                    });
                }
            }

            confirmEmbed.addFields({
                name: '🔗 Enlace',
                value: `[Ir al mensaje](${mensajeEnviado.url})`,
                inline: false
            });

            confirmEmbed.setTimestamp();

            await interaction.editReply({ embeds: [confirmEmbed] });

            console.log(`Comando sanciones completado exitosamente por ${interaction.user.tag}`);

        } catch (error) {
            console.error('Error en comando sanciones:', error);
            console.error('Stack trace:', error.stack);

            const errorEmbed = new EmbedBuilder()
                .setColor('#ff0000')
                .setTitle('❌ Error al Aplicar Sanción')
                .setDescription(getErrorMessage(error))
                .addFields({
                    name: '📝 Detalles',
                    value: `\`${error.message}\``,
                    inline: false
                })
                .setTimestamp();

            try {
                if (interaction.deferred || interaction.replied) {
                    await interaction.editReply({ embeds: [errorEmbed] });
                } else {
                    await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
                }
            } catch (replyError) {
                console.error('Error al responder:', replyError);
            }
        }
    }
};

/**
 * Envía el log de la sanción
 */
async function enviarLog(interaction, client, datos) {
    const { sancionGuardada, usuarioData, mensajeEnviado, canalDestino, embedConfig, usuario } = datos;

    const logEmbed = new EmbedBuilder()
        .setTitle('📋 Registro de Sanción')
        .setColor(embedConfig.color)
        .setDescription(`**Tipo:** ${embedConfig.titulo}\n**ID:** \`${sancionGuardada._id}\``)
        .addFields(
            {
                name: '👨‍⚖️ Staff Responsable',
                value: `${interaction.user.tag} (${interaction.user.id})`,
                inline: true
            },
            {
                name: '🎯 Objetivo',
                value: usuario ? `${usuario.tag} (<@${usuario.id}>)` : sancionGuardada.organizacion || 'N/A',
                inline: true
            }
        );

    if (usuario) {
        logEmbed.addFields({
            name: '🆔 Discord ID',
            value: usuario.id,
            inline: true
        });
    }

    if (sancionGuardada.warningGrupo) {
        logEmbed.addFields({
            name: '📊 Warning',
            value: `Grupo ${sancionGuardada.warningGrupo} - Warning ${sancionGuardada.warningNumero}/3`,
            inline: true
        });
    }

    if (usuarioData) {
        logEmbed.addFields({
            name: '📈 Estadísticas del Usuario',
            value: `Warnings: ${usuarioData.totalWarnings} | Kicks: ${usuarioData.totalKicks} | Bans: ${usuarioData.totalBans}`,
            inline: false
        });
    }

    // CORRECCIÓN: Verificar que fechaFin existe y no es null antes de usar .getTime()
    if (sancionGuardada.duracionDias && sancionGuardada.fechaFin) {
        logEmbed.addFields({
            name: '⏱️ Duración',
            value: `${sancionGuardada.duracionDias} día(s)\nFinaliza: <t:${Math.floor(sancionGuardada.fechaFin.getTime() / 1000)}:F>`,
            inline: false
        });
    }

    logEmbed.addFields(
        {
            name: '⚠️ Motivos',
            value: sancionGuardada.motivos.join(', '),
            inline: false
        },
        {
            name: '📝 Descripción',
            value: sancionGuardada.descripcion.length > 1024 ? `${sancionGuardada.descripcion.slice(0, 1021)}...` : sancionGuardada.descripcion,
            inline: false
        },
        {
            name: '📡 Canal',
            value: `${canalDestino} (${canalDestino.name})`,
            inline: true
        },
        {
            name: '🆔 ID Mensaje',
            value: mensajeEnviado.id,
            inline: true
        },
        {
            name: '🕒 Fecha',
            value: `<t:${Math.floor(Date.now() / 1000)}:F>`,
            inline: false
        }
    )
        .setThumbnail(interaction.user.displayAvatarURL({ size: 256 }))
        .setTimestamp();

    const logChannelId = config.ChannelLogs;
    const logChannel = client.channels.cache.get(logChannelId);

    if (logChannel?.permissionsFor(interaction.guild.members.me)?.has(['SendMessages', 'ViewChannel'])) {
        try {
            await logChannel.send({ embeds: [logEmbed] });
            console.log('Log de sanción enviado exitosamente');
        } catch (error) {
            console.error('Error enviando log:', error.message);
        }
    } else {
        console.warn('Canal de logs no encontrado o sin permisos');
    }
}

/**
 * Configuración de embeds
 */
function getEmbedConfig(tipo) {
    const configs = {
        warning: {
            titulo: '⚠️ Nuevo Warning Aplicado',
            color: 0xFFA500,
            mencion: '||@everyone||',
            nombreCampo: '👤 Jugador'
        },
        kick: {
            titulo: '🚫 Expulsión del Servidor',
            color: 0xFF6B6B,
            mencion: '||@everyone||',
            nombreCampo: '👤 Jugador'
        },
        ban_temporal: {
            titulo: '🔨 Ban Temporal Aplicado',
            color: 0xFF4444,
            mencion: '||@everyone||',
            nombreCampo: '👤 Jugador'
        },
        ban_permanente: {
            titulo: '🔒 Ban Permanente Aplicado',
            color: 0x8B0000,
            mencion: '||@everyone||',
            nombreCampo: '👤 Jugador'
        },
        organizacion: {
            titulo: '🏢 Sanción a Organización',
            color: 0xFF8800,
            mencion: '||@everyone||',
            nombreCampo: '🏢 Organización'
        },
        faccion_legal: {
            titulo: '⚖️ Sanción a Facción Legal',
            color: 0x0088FF,
            mencion: '||@everyone||',
            nombreCampo: '⚖️ Facción Legal'
        }
    };

    return configs[tipo] || configs.warning;
}

/**
 * Mensajes de error
 */
function getErrorMessage(error) {
    const errorMessages = {
        50013: 'No tengo permisos suficientes para realizar esta acción.',
        50001: 'No tengo acceso al canal especificado.',
        10003: 'Canal no encontrado.',
        10062: 'La interacción ha expirado. Intenta ejecutar el comando nuevamente.',
        10008: 'Usuario no encontrado.',
        11000: 'Este usuario ya está registrado en la base de datos.'
    };

    return errorMessages[error.code] || 'Ocurrió un error inesperado al procesar la sanción.';
}