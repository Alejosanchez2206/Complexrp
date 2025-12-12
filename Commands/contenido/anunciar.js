const {
    SlashCommandBuilder,
    Client,
    ChatInputCommandInteraction,
    ChannelType,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ActionRowBuilder,
    EmbedBuilder
} = require('discord.js');

const validarPermiso = require('../../utils/ValidarPermisos');
const config = require('../../config.json');
module.exports = {
    data: new SlashCommandBuilder()
        .setName('anunciar')
        .setDescription('manda un anuncio')
        .addChannelOption(option =>
            option.setName('canal')
                .setDescription('Canal donde enviar el anuncio (opcional)')
                .setRequired(false)
                .addChannelTypes(ChannelType.GuildText)
        ),

    /**
     * @param {ChatInputCommandInteraction} interaction
     * @param {Client} client
     * @returns {Promise<void>}
     */
    async execute(interaction, client) {
        try {
            // ===== VALIDAR PERMISOS =====
            const tienePermiso = await validarPermiso(interaction, 'annunciar');

            if (!tienePermiso) {
                return interaction.reply({
                    content: '❌ No tienes permisos para usar este comando\n> Necesitas el permiso: `annunciar`',
                    ephemeral: true
                });
            }


            // Obtener el canal especificado o null si no se especificó
            const canalEspecificado = interaction.options.getChannel('canal') || interaction.channel;

            // Crear el modal
            const modal = new ModalBuilder()
                .setCustomId('anuncio_modal')
                .setTitle('Crear Anuncio');

            // Campo de texto para el anuncio
            const anuncioInput = new TextInputBuilder()
                .setCustomId('anuncio_text')
                .setLabel('Mensaje del anuncio')
                .setStyle(TextInputStyle.Paragraph)
                .setPlaceholder('Escribe tu anuncio aquí...')
                .setRequired(true)
                .setMaxLength(2000);

            const anuncioRow = new ActionRowBuilder().addComponents(anuncioInput);
            modal.addComponents(anuncioRow);

            // Mostrar el modal
            await interaction.showModal(modal);

            // Esperar la respuesta del modal
            const modalSubmission = await interaction.awaitModalSubmit({
                time: 600000, // 10 minutos
                filter: i => i.user.id === interaction.user.id && i.customId === 'anuncio_modal'
            });

            const anuncioTexto = modalSubmission.fields.getTextInputValue('anuncio_text');

            let canalSeleccionado;

            // Si se especificó un canal, usar ese canal
            if (canalEspecificado) {
                canalSeleccionado = canalEspecificado;

                // Verificar permisos en el canal especificado
                if (!canalSeleccionado.permissionsFor(interaction.guild.members.me).has('SendMessages')) {
                    return modalSubmission.reply({
                        content: 'No tengo permisos para enviar mensajes en ese canal.',
                        ephemeral: true
                    });
                }


                // Enviar el anuncio directamente
                await canalSeleccionado.send({
                    content: anuncioTexto
                });

                // Responder al usuario
                await modalSubmission.reply({
                    content: `✅ Anuncio enviado exitosamente a ${canalSeleccionado}`,
                    ephemeral: true
                });

            }

            // Crear embed para el log
            const logEmbed = new EmbedBuilder()
                .setTitle('📢 Nuevo Anuncio Enviado')
                .setColor(0x00AE86)
                .addFields(
                    {
                        name: '👤 Usuario',
                        value: `${interaction.user.tag} (${interaction.user.id})`,
                        inline: false
                    },
                    {
                        name: '📝 Canal',
                        value: `${canalSeleccionado} (${canalSeleccionado.name})`,
                        inline: false
                    },
                    {
                        name: '🕒 Fecha',
                        value: `<t:${Math.floor(Date.now() / 1000)}:F>`,
                        inline: false
                    },
                    {
                        name: '💬 Mensaje',
                        value: anuncioTexto.length > 1000 ?
                            `${anuncioTexto.slice(0, 1000)}...` :
                            anuncioTexto,
                        inline: false
                    }
                )
                .setThumbnail(interaction.user.displayAvatarURL())
                .setTimestamp();

            if (interaction.user.id !== config.Owners) {
                // Buscar canal de logs
                const logChannelId = config.ChannelLogs;
                const logChannel = interaction.guild.channels.cache.get(logChannelId);

                if (logChannel && logChannel.permissionsFor(interaction.guild.members.me).has('SendMessages')) {
                    try {
                        await logChannel.send({ embeds: [logEmbed] });
                    } catch (logError) {
                        console.error('Error enviando log:', logError.message);
                    }
                }
            }

        } catch (error) {
            console.error(`Error en el sistema de anuncios: ${error.message}`);

            // Manejar diferentes tipos de errores
            if (error.code === 'InteractionCollectorError') {
                // Timeout - el usuario no respondió a tiempo
                return;
            }

            // Intentar responder dependiendo del estado de la interacción
            const errorMessage = 'Error en el sistema de anuncios';

            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({ content: errorMessage, ephemeral: true });
            } else if (interaction.deferred) {
                await interaction.followUp({ content: errorMessage, ephemeral: true });
            }
        }
    }
}