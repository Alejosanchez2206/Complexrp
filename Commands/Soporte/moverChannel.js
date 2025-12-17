const {
    SlashCommandBuilder,
    Client,
    ChatInputCommandInteraction,
    EmbedBuilder,
    ChannelType,
    PermissionFlagsBits,
    PermissionsBitField
} = require('discord.js');

const validarPermiso = require('../../utils/ValidarPermisos');
const config = require('../../config.json');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('movercanal')
        .setDescription('Mueve este canal a una categoría específica heredando sus permisos')
        .addStringOption(option => option
            .setName('categoria')
            .setDescription('Categoría de destino')
            .setRequired(true)
            .addChoices(
                { name: '🏢 Organización', value: '1054457925969661982' },
                { name: '📞 Soporte', value: '1054457580535156827' },
                { name: '📝 Reportes', value: '1054457481230811256' },
                { name: '⭐ Vip', value: '1054461319765557348' },
                { name: '⚙️ Staff', value: '1093699269900378133' },
                { name: '📢 Urgentes', value: '1163176227318796319' },
                { name: '🎉 Creadores contenido', value: '1054457758038114336' },
                { name: '📊 Premios', value: '1194204998926618646' },
                { name: '✨ Devolución', value: '1213393307711967242' },
                { name: '👑 Negocios', value: '1261178468222369813' },
                { name: '🖥️ Developers', value: '1158939241070481518' },
                { name: '⭐ Vip 2', value: '1312955840818446406' }
            )
        )
        .addIntegerOption(option => option
            .setName('posicion')
            .setDescription('Posición del canal dentro de la categoría (1 = primero)')
            .setMinValue(1)
            .setMaxValue(50)
            .setRequired(false)
        )
        .addBooleanOption(option => option
            .setName('heredar_permisos')
            .setDescription('¿Sincronizar permisos con la categoría? (Por defecto: Sí)')
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

            console.log(`Comando movercanal ejecutado por: ${interaction.user.tag} (${interaction.user.id})`);

            // ===== VALIDAR PERMISOS =====
            const tienePermiso = await validarPermiso(interaction, 'gestionar_tickets');

            if (!tienePermiso) {
                return interaction.editReply({
                    content: '❌ No tienes permisos para usar este comando\n> Necesitas el permiso: `gestionar_tickets`'
                });
            }

            // Obtener el canal donde se ejecutó el comando
            const canal = interaction.channel;
            const categoriaId = interaction.options.getString('categoria');
            const posicion = interaction.options.getInteger('posicion');
            const heredarPermisos = interaction.options.getBoolean('heredar_permisos') ?? false;

            // Verificar que sea un canal de texto o voz
            if (![ChannelType.GuildText, ChannelType.GuildVoice].includes(canal.type)) {
                return interaction.editReply({
                    content: '❌ Este comando solo puede usarse en canales de texto o voz.'
                });
            }

            // Obtener la categoría del servidor
            const categoriaDestino = interaction.guild.channels.cache.get(categoriaId);

            if (!categoriaDestino) {
                return interaction.editReply({
                    content: `❌ No se encontró la categoría en el servidor.\n> ID: \`${categoriaId}\``
                });
            }

            if (categoriaDestino.type !== ChannelType.GuildCategory) {
                return interaction.editReply({
                    content: '❌ El canal configurado no es una categoría válida.'
                });
            }

            // Verificar que el canal no esté ya en esa categoría
            if (canal.parentId === categoriaId) {
                return interaction.editReply({
                    content: `⚠️ Este canal ya se encuentra en la categoría **${categoriaDestino.name}**.`
                });
            }

            // Verificar permisos del bot
            const botMember = interaction.guild.members.me;
            if (!botMember.permissions.has(PermissionFlagsBits.ManageChannels)) {
                return interaction.editReply({
                    content: '❌ No tengo el permiso `Gestionar Canales` necesario para mover canales.'
                });
            }

            // ===== GUARDAR PERMISOS DE USUARIOS ANTES DE MOVER =====
            const permisosUsuarios = [];
            
            canal.permissionOverwrites.cache.forEach((overwrite) => {
                // Solo guardar permisos de usuarios (no roles)
                if (overwrite.type === 1) { // 1 = member/usuario
                    permisosUsuarios.push({
                        id: overwrite.id,
                        allow: overwrite.allow,
                        deny: overwrite.deny
                    });
                }
            });

            console.log(`Permisos de usuarios guardados: ${permisosUsuarios.length}`);

            // Guardar información de la categoría anterior
            const categoriaAnterior = canal.parent;
            const categoriaAnteriorNombre = categoriaAnterior?.name || 'Sin categoría';

            // Mover el canal a la categoría
            await canal.setParent(categoriaId, {
                lockPermissions: heredarPermisos,
                reason: `Canal movido por ${interaction.user.tag} usando /movercanal`
            });

            // ===== RESTAURAR PERMISOS DE USUARIOS =====
            const usuariosRestaurados = [];
            
            for (const permiso of permisosUsuarios) {
                try {
                    await canal.permissionOverwrites.create(permiso.id, {
                        ViewChannel: true,
                        SendMessages: true,
                        ReadMessageHistory: true,
                        AttachFiles: true,
                        EmbedLinks: true,
                        AddReactions: true
                    }, {
                        reason: `Permisos restaurados después de mover canal - Usuario mantenido`
                    });
                    
                    usuariosRestaurados.push(permiso.id);
                    console.log(`Permisos restaurados para usuario: ${permiso.id}`);
                } catch (error) {
                    console.error(`Error restaurando permisos para ${permiso.id}:`, error.message);
                }
            }

            // Si se especificó posición, cambiar el orden
            let posicionFinal = null;
            if (posicion) {
                // Obtener canales de la categoría (excluyendo el canal actual)
                const canalesEnCategoria = interaction.guild.channels.cache
                    .filter(c => c.parentId === categoriaId && c.id !== canal.id)
                    .sort((a, b) => a.position - b.position);

                // Calcular la posición real
                const canalesArray = Array.from(canalesEnCategoria.values());
                const totalCanales = canalesArray.length + 1;
                const posicionDeseada = Math.min(posicion, totalCanales);

                // Calcular la posición absoluta
                let nuevaPosicion;
                if (posicionDeseada === 1) {
                    nuevaPosicion = canalesArray.length > 0 ? canalesArray[0].position : categoriaDestino.position + 1;
                } else if (posicionDeseada >= totalCanales) {
                    nuevaPosicion = canalesArray.length > 0 
                        ? canalesArray[canalesArray.length - 1].position + 1 
                        : categoriaDestino.position + 1;
                } else {
                    nuevaPosicion = canalesArray[posicionDeseada - 1].position;
                }

                await canal.setPosition(nuevaPosicion);
                posicionFinal = posicionDeseada;
            }

            console.log(`Canal ${canal.name} movido de "${categoriaAnteriorNombre}" a "${categoriaDestino.name}" por ${interaction.user.tag}${posicionFinal ? ` en posición ${posicionFinal}` : ''}`);

            // Crear embed de confirmación
            const confirmEmbed = new EmbedBuilder()
                .setColor('#00ff00')
                .setTitle('✅ Canal Movido Exitosamente')
                .addFields(
                    {
                        name: '📺 Canal',
                        value: `${canal} (\`${canal.name}\`)`,
                        inline: true
                    },
                    {
                        name: '📁 Categoría Anterior',
                        value: categoriaAnteriorNombre,
                        inline: true
                    },
                    {
                        name: '📂 Nueva Categoría',
                        value: categoriaDestino.name,
                        inline: true
                    }
                );

            // Agregar posición si se especificó
            if (posicionFinal) {
                confirmEmbed.addFields({
                    name: '📍 Posición',
                    value: `#${posicionFinal}`,
                    inline: true
                });
            }

            // Mostrar usuarios con permisos mantenidos
            if (usuariosRestaurados.length > 0) {
                const usuariosMenciones = usuariosRestaurados.map(id => `<@${id}>`).join(', ');
                confirmEmbed.addFields({
                    name: '👥 Usuarios con Acceso',
                    value: usuariosMenciones.length > 1024 
                        ? `${usuariosRestaurados.length} usuario(s) mantienen acceso`
                        : usuariosMenciones,
                    inline: false
                });
            }

            confirmEmbed.addFields({
                name: '🔐 Permisos',
                value: heredarPermisos
                    ? '✅ Sincronizados con la categoría (usuarios mantenidos)'
                    : '⚠️ Permisos originales mantenidos',
                inline: false
            })
                .setFooter({
                    text: `Ejecutado por ${interaction.user.tag}`,
                    iconURL: interaction.user.displayAvatarURL({ size: 64 })
                })
                .setTimestamp();

            await interaction.editReply({ embeds: [confirmEmbed] });

            // Enviar log si está configurado
            await enviarLog(interaction, client, {
                canal,
                categoriaAnteriorNombre,
                categoriaDestino,
                heredarPermisos,
                posicionFinal,
                usuariosRestaurados
            });

        } catch (error) {
            console.error('Error en comando movercanal:', error);
            console.error('Stack trace:', error.stack);

            const errorEmbed = new EmbedBuilder()
                .setColor('#ff0000')
                .setTitle('❌ Error al Mover Canal')
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
 * Envía el log del movimiento de canal
 */
async function enviarLog(interaction, client, datos) {
    const { canal, categoriaAnteriorNombre, categoriaDestino, heredarPermisos, posicionFinal, usuariosRestaurados } = datos;

    const logEmbed = new EmbedBuilder()
        .setTitle('📋 Canal Movido')
        .setColor('#0099ff')
        .addFields(
            {
                name: '👤 Staff Responsable',
                value: `${interaction.user.tag} (<@${interaction.user.id}>)`,
                inline: true
            },
            {
                name: '📺 Canal',
                value: `${canal} (\`${canal.id}\`)`,
                inline: true
            },
            {
                name: '📁 Origen',
                value: categoriaAnteriorNombre,
                inline: true
            },
            {
                name: '📂 Destino',
                value: categoriaDestino.name,
                inline: true
            },
            {
                name: '📍 Posición',
                value: posicionFinal ? `#${posicionFinal}` : 'Por defecto',
                inline: true
            },
            {
                name: '🔐 Sincronización',
                value: heredarPermisos ? 'Sí' : 'No',
                inline: true
            },
            {
                name: '👥 Usuarios Mantenidos',
                value: usuariosRestaurados.length > 0 
                    ? usuariosRestaurados.map(id => `<@${id}>`).join(', ').slice(0, 1024)
                    : 'Ninguno',
                inline: false
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
            console.log('Log de movimiento de canal enviado exitosamente');
        } catch (error) {
            console.error('Error enviando log:', error.message);
        }
    } else {
        console.warn('Canal de logs no encontrado o sin permisos');
    }
}

/**
 * Mensajes de error personalizados
 */
function getErrorMessage(error) {
    const errorMessages = {
        50013: 'No tengo permisos suficientes para mover este canal.',
        50001: 'No tengo acceso al canal o categoría especificada.',
        10003: 'Canal o categoría no encontrada.',
        10062: 'La interacción ha expirado. Intenta ejecutar el comando nuevamente.',
        50035: 'La categoría ha alcanzado el límite máximo de canales (50).'
    };

    return errorMessages[error.code] || 'Ocurrió un error inesperado al mover el canal.';
}