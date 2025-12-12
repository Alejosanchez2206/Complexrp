const { SlashCommandBuilder, Client, PermissionFlagsBits, ChatInputCommandInteraction, ChannelType } = require('discord.js');
const permisosEspecialSchema = require('../../Models/permisosEspecial');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('purge-user')
        .setDescription('Elimina todos los mensajes de un usuario en las últimas 24 horas')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        // OPCIÓN REQUERIDA PRIMERO
        .addUserOption(option =>
            option.setName('usuario')
                .setDescription('Usuario cuyos mensajes serán eliminados')
                .setRequired(true)
        )
        // OPCIONES NO REQUERIDAS DESPUÉS
        .addChannelOption(option =>
            option.setName('canal')
                .setDescription('Canal específico (opcional, por defecto todos los canales)')
                .addChannelTypes(ChannelType.GuildText)
                .setRequired(false)
        )
        .addIntegerOption(option =>
            option.setName('horas')
                .setDescription('Rango de tiempo en horas (por defecto 24)')
                .setMinValue(1)
                .setMaxValue(168)
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

            // Verificar permisos del bot
            const botMember = interaction.guild.members.me;
            if (!botMember.permissions.has(PermissionFlagsBits.ManageMessages)) {
                return interaction.reply({
                    content: '❌ No tengo permisos para eliminar mensajes en este servidor.',
                    ephemeral: true
                });
            }

            await interaction.deferReply({ ephemeral: true });

            // Obtener opciones
            const targetUser = interaction.options.getUser('usuario');
            const specificChannel = interaction.options.getChannel('canal');
            const hours = interaction.options.getInteger('horas') || 24;
            
            const timeAgo = new Date(Date.now() - hours * 60 * 60 * 1000);

            // Determinar canales a procesar
            const channelsToProcess = specificChannel
                ? [specificChannel]
                : interaction.guild.channels.cache.filter(channel => 
                    channel.type === ChannelType.GuildText &&
                    channel.permissionsFor(botMember).has(PermissionFlagsBits.ViewChannel) &&
                    channel.permissionsFor(botMember).has(PermissionFlagsBits.ManageMessages)
                  );

            let totalDeleted = 0;
            let channelsProcessed = 0;
            let channelsWithErrors = 0;
            const errorChannels = [];

            // Procesar canales
            for (const channel of channelsToProcess.values()) {
                try {
                    let channelDeleted = 0;
                    let lastMessageId;
                    let hasMoreMessages = true;

                    // Paginación para obtener más de 100 mensajes
                    while (hasMoreMessages) {
                        const fetchOptions = { limit: 100 };
                        if (lastMessageId) {
                            fetchOptions.before = lastMessageId;
                        }

                        const messages = await channel.messages.fetch(fetchOptions);
                        
                        if (messages.size === 0) {
                            hasMoreMessages = false;
                            break;
                        }

                        const userMessages = messages.filter(msg =>
                            msg.author.id === targetUser.id &&
                            msg.createdTimestamp > timeAgo.getTime()
                        );

                        if (userMessages.size === 0) {
                            // Si no hay mensajes del usuario en este lote, continuar
                            lastMessageId = messages.last()?.id;
                            
                            // Si el mensaje más antiguo es anterior al rango de tiempo, detener
                            if (messages.last()?.createdTimestamp < timeAgo.getTime()) {
                                hasMoreMessages = false;
                            }
                            continue;
                        }

                        // Separar mensajes recientes (bulk delete) y antiguos (delete individual)
                        const twoWeeksAgo = Date.now() - 14 * 24 * 60 * 60 * 1000;
                        const recentMessages = userMessages.filter(msg => msg.createdTimestamp > twoWeeksAgo);
                        const oldMessages = userMessages.filter(msg => msg.createdTimestamp <= twoWeeksAgo);

                        // Bulk delete para mensajes recientes (más eficiente)
                        if (recentMessages.size > 0) {
                            try {
                                await channel.bulkDelete(recentMessages, true);
                                channelDeleted += recentMessages.size;
                            } catch (bulkError) {
                                console.error(`Error en bulk delete en ${channel.name}:`, bulkError);
                                // Fallback: eliminar uno por uno
                                for (const message of recentMessages.values()) {
                                    try {
                                        await message.delete();
                                        channelDeleted++;
                                        await new Promise(resolve => setTimeout(resolve, 100));
                                    } catch (deleteError) {
                                        console.error(`Error eliminando mensaje individual: ${deleteError.message}`);
                                    }
                                }
                            }
                        }

                        // Delete individual para mensajes antiguos
                        for (const message of oldMessages.values()) {
                            try {
                                await message.delete();
                                channelDeleted++;
                                await new Promise(resolve => setTimeout(resolve, 300));
                            } catch (deleteError) {
                                console.error(`Error eliminando mensaje antiguo: ${deleteError.message}`);
                            }
                        }

                        lastMessageId = messages.last()?.id;
                        
                        // Si el mensaje más antiguo es anterior al rango de tiempo, detener
                        if (messages.last()?.createdTimestamp < timeAgo.getTime()) {
                            hasMoreMessages = false;
                        }

                        // Actualizar progreso cada canal
                        if (channelDeleted > 0) {
                            await interaction.editReply({
                                content: `🔄 Procesando... ${channelDeleted} mensajes eliminados en ${channel.name}`,
                                ephemeral: true
                            });
                        }
                    }

                    totalDeleted += channelDeleted;
                    channelsProcessed++;

                } catch (channelError) {
                    console.error(`Error en el canal ${channel.name}:`, channelError);
                    channelsWithErrors++;
                    errorChannels.push(channel.name);
                    continue;
                }
            }

            // Respuesta final detallada
            let responseMessage = `✅ **Operación completada**\n\n`;
            responseMessage += `👤 Usuario: ${targetUser.tag}\n`;
            responseMessage += `🗑️ Mensajes eliminados: **${totalDeleted}**\n`;
            responseMessage += `⏱️ Rango de tiempo: ${hours} hora(s)\n`;
            responseMessage += `📺 Canales procesados: ${channelsProcessed}\n`;

            if (channelsWithErrors > 0) {
                responseMessage += `\n⚠️ Canales con errores: ${channelsWithErrors}\n`;
                responseMessage += `Canales: ${errorChannels.join(', ')}`;
            }

            await interaction.editReply({
                content: responseMessage,
                ephemeral: true
            });

        } catch (error) {
            console.error('Error al ejecutar el comando purge-user:', error);
            
            const errorMessage = {
                content: '❌ Ocurrió un error al ejecutar el comando. Por favor, intenta de nuevo.',
                ephemeral: true
            };

            if (interaction.deferred || interaction.replied) {
                await interaction.editReply(errorMessage);
            } else {
                await interaction.reply(errorMessage);
            }
        }
    }
};