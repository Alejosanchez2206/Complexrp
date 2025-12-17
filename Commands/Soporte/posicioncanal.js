const {
    SlashCommandBuilder,
    Client,
    ChatInputCommandInteraction,
    EmbedBuilder,
    ChannelType,
    PermissionFlagsBits
} = require('discord.js');

const validarPermiso = require('../../utils/ValidarPermisos');
const config = require('../../config.json');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('posicioncanal')
        .setDescription('Cambia la posición de este canal dentro de su categoría actual')
        .addIntegerOption(option => option
            .setName('posicion')
            .setDescription('Nueva posición del canal (1 = primero)')
            .setMinValue(1)
            .setMaxValue(50)
            .setRequired(true)
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

            console.log(`Comando posicioncanal ejecutado por: ${interaction.user.tag} (${interaction.user.id})`);

            // ===== VALIDAR PERMISOS =====
            const tienePermiso = await validarPermiso(interaction, 'gestionar_tickets');

            if (!tienePermiso) {
                return interaction.editReply({
                    content: '❌ No tienes permisos para usar este comando\n> Necesitas el permiso: `gestionar_tickets`'
                });
            }

            // Obtener el canal donde se ejecutó el comando
            const canal = interaction.channel;
            const posicion = interaction.options.getInteger('posicion');

            // Verificar que sea un canal de texto o voz
            if (![ChannelType.GuildText, ChannelType.GuildVoice].includes(canal.type)) {
                return interaction.editReply({
                    content: '❌ Este comando solo puede usarse en canales de texto o voz.'
                });
            }

            // Verificar que el canal esté en una categoría
            if (!canal.parentId) {
                return interaction.editReply({
                    content: '❌ Este canal no está dentro de ninguna categoría.'
                });
            }

            // Verificar permisos del bot
            const botMember = interaction.guild.members.me;
            if (!botMember.permissions.has(PermissionFlagsBits.ManageChannels)) {
                return interaction.editReply({
                    content: '❌ No tengo el permiso `Gestionar Canales` necesario para mover canales.'
                });
            }

            // Obtener la categoría actual
            const categoriaActual = canal.parent;

            // Obtener canales de la categoría (excluyendo el canal actual)
            const canalesEnCategoria = interaction.guild.channels.cache
                .filter(c => c.parentId === canal.parentId && c.id !== canal.id)
                .sort((a, b) => a.position - b.position);

            const canalesArray = Array.from(canalesEnCategoria.values());
            const totalCanales = canalesArray.length + 1;

            // Guardar posición anterior
            const posicionAnterior = canalesArray.filter(c => c.position < canal.position).length + 1;

            // Calcular la posición deseada
            const posicionDeseada = Math.min(posicion, totalCanales);

            // Verificar si ya está en esa posición
            if (posicionAnterior === posicionDeseada) {
                return interaction.editReply({
                    content: `⚠️ Este canal ya se encuentra en la posición **#${posicionDeseada}**.`
                });
            }

            // Calcular la posición absoluta
            let nuevaPosicion;
            if (posicionDeseada === 1) {
                // Primera posición
                nuevaPosicion = canalesArray.length > 0 ? canalesArray[0].position : categoriaActual.position + 1;
            } else if (posicionDeseada >= totalCanales) {
                // Última posición
                nuevaPosicion = canalesArray.length > 0 
                    ? canalesArray[canalesArray.length - 1].position + 1 
                    : categoriaActual.position + 1;
            } else {
                // Posición intermedia
                nuevaPosicion = canalesArray[posicionDeseada - 1].position;
            }

            // Cambiar posición
            await canal.setPosition(nuevaPosicion, {
                reason: `Posición cambiada por ${interaction.user.tag} usando /posicioncanal`
            });

            console.log(`Canal ${canal.name} movido de posición #${posicionAnterior} a #${posicionDeseada} por ${interaction.user.tag}`);

            // Crear embed de confirmación
            const confirmEmbed = new EmbedBuilder()
                .setColor('#00ff00')
                .setTitle('✅ Posición Cambiada Exitosamente')
                .addFields(
                    {
                        name: '📺 Canal',
                        value: `${canal} (\`${canal.name}\`)`,
                        inline: true
                    },
                    {
                        name: '📁 Categoría',
                        value: categoriaActual.name,
                        inline: true
                    },
                    {
                        name: '📍 Posición',
                        value: `#${posicionAnterior} → #${posicionDeseada}`,
                        inline: true
                    }
                )
                .setFooter({
                    text: `Ejecutado por ${interaction.user.tag}`,
                    iconURL: interaction.user.displayAvatarURL({ size: 64 })
                })
                .setTimestamp();

            await interaction.editReply({ embeds: [confirmEmbed] });

            // Enviar log si está configurado
            await enviarLog(interaction, client, {
                canal,
                categoriaActual,
                posicionAnterior,
                posicionDeseada
            });

        } catch (error) {
            console.error('Error en comando posicioncanal:', error);
            console.error('Stack trace:', error.stack);

            const errorEmbed = new EmbedBuilder()
                .setColor('#ff0000')
                .setTitle('❌ Error al Cambiar Posición')
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
 * Envía el log del cambio de posición
 */
async function enviarLog(interaction, client, datos) {
    const { canal, categoriaActual, posicionAnterior, posicionDeseada } = datos;

    const logEmbed = new EmbedBuilder()
        .setTitle('📋 Posición de Canal Cambiada')
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
                name: '📁 Categoría',
                value: categoriaActual.name,
                inline: true
            },
            {
                name: '📍 Posición Anterior',
                value: `#${posicionAnterior}`,
                inline: true
            },
            {
                name: '📍 Nueva Posición',
                value: `#${posicionDeseada}`,
                inline: true
            },
            {
                name: '🕒 Fecha',
                value: `<t:${Math.floor(Date.now() / 1000)}:F>`,
                inline: true
            }
        )
        .setThumbnail(interaction.user.displayAvatarURL({ size: 256 }))
        .setTimestamp();

    const logChannelId = config.ChannelLogs;
    const logChannel = client.channels.cache.get(logChannelId);

    if (logChannel?.permissionsFor(interaction.guild.members.me)?.has(['SendMessages', 'ViewChannel'])) {
        try {
            await logChannel.send({ embeds: [logEmbed] });
            console.log('Log de cambio de posición enviado exitosamente');
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
        50001: 'No tengo acceso al canal especificado.',
        10003: 'Canal no encontrado.',
        10062: 'La interacción ha expirado. Intenta ejecutar el comando nuevamente.'
    };

    return errorMessages[error.code] || 'Ocurrió un error inesperado al cambiar la posición.';
}