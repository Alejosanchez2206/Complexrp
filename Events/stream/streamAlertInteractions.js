// events/streamAlertInteractions.js
const { Events, EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
const streamAlertSchema = require('../../Models/streamAlertConfig');

module.exports = {
    name: Events.InteractionCreate,
    once: false,

    /**
     * @param {import('discord.js').Interaction} interaction
     * @param {import('discord.js').Client} client
     */
    async execute(interaction, client) {
        try {
            // === SELECT MENUS ===
            if (interaction.isStringSelectMenu()) {
                // Configuración general
                if (interaction.customId === 'sa_config_menu') {
                    await handleConfigMenu(interaction);
                }
                
                // Editar streamer
                if (interaction.customId.startsWith('sa_edit_')) {
                    await handleEditStreamer(interaction);
                }
            }

            // === BUTTONS ===
            if (interaction.isButton()) {
                // Configurar API keys
                if (interaction.customId.startsWith('sa_api_')) {
                    await handleAPIButton(interaction);
                }
            }

            // === MODALS ===
            if (interaction.isModalSubmit()) {
                // Configuración
                if (interaction.customId.startsWith('sa_modal_config_')) {
                    await handleConfigModal(interaction);
                }

                // API Keys
                if (interaction.customId.startsWith('sa_modal_api_')) {
                    await handleAPIModal(interaction);
                }

                // Editar streamer
                if (interaction.customId.startsWith('sa_modal_edit_')) {
                    await handleEditStreamerModal(interaction);
                }
            }

        } catch (error) {
            console.error('Error en streamAlertInteractions:', error);
            
            const errorMessage = `❌ Error: ${error.message}`;
            
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({ content: errorMessage, ephemeral: true }).catch(() => {});
            } else {
                await interaction.followUp({ content: errorMessage, ephemeral: true }).catch(() => {});
            }
        }
    }
};

// ==================== CONFIGURACIÓN ====================

async function handleConfigMenu(interaction) {
    const config = await streamAlertSchema.findOne({
        guildId: interaction.guild.id
    });

    if (!config) {
        return interaction.reply({
            content: '❌ No hay configuración.',
            ephemeral: true
        });
    }

    const option = interaction.values[0];

    // Para opciones que muestran modales, NO usar deferUpdate
    if (option === 'interval' || option === 'message') {
        if (option === 'interval') {
            await showIntervalModal(interaction, config);
        } else if (option === 'message') {
            await showMessageModal(interaction, config);
        }
        return;
    }

    // Para opciones que solo actualizan, usar deferUpdate
    await interaction.deferUpdate();

    switch (option) {
        case 'autodelete':
            config.settings.autoDeleteMessages = !config.settings.autoDeleteMessages;
            await config.save();
            await interaction.followUp({
                content: `✅ Auto-eliminar mensajes: **${config.settings.autoDeleteMessages ? 'Activado' : 'Desactivado'}**`,
                ephemeral: true
            });
            break;
        case 'thumbnail':
            config.settings.includeThumbnail = !config.settings.includeThumbnail;
            await config.save();
            await interaction.followUp({
                content: `✅ Incluir thumbnail: **${config.settings.includeThumbnail ? 'Activado' : 'Desactivado'}**`,
                ephemeral: true
            });
            break;
        case 'keywords':
            config.settings.requireKeywords = !config.settings.requireKeywords;
            await config.save();
            await interaction.followUp({
                content: `✅ Requerir keywords: **${config.settings.requireKeywords ? 'Activado' : 'Desactivado'}**\n${config.settings.requireKeywords ? '⚠️ Solo se notificarán streams que contengan palabras clave en el título.' : ''}`,
                ephemeral: true
            });
            break;
        case 'channel':
            await interaction.followUp({
                content: '💡 Usa el comando `/streamalert setup` con un nuevo canal para cambiar el canal de alertas.',
                ephemeral: true
            });
            break;
    }
}

async function showIntervalModal(interaction, config) {
    const modal = new ModalBuilder()
        .setCustomId('sa_modal_config_interval')
        .setTitle('Intervalo de Verificación');

    const input = new TextInputBuilder()
        .setCustomId('interval')
        .setLabel('Intervalo en minutos (1-60)')
        .setStyle(TextInputStyle.Short)
        .setValue(config.settings.checkInterval.toString())
        .setMinLength(1)
        .setMaxLength(2)
        .setRequired(true);

    const row = new ActionRowBuilder().addComponents(input);
    modal.addComponents(row);

    await interaction.showModal(modal);
}

async function showMessageModal(interaction, config) {
    const modal = new ModalBuilder()
        .setCustomId('sa_modal_config_message')
        .setTitle('Mensaje por Defecto');

    const input = new TextInputBuilder()
        .setCustomId('message')
        .setLabel('Mensaje (usa {streamer} para el nombre)')
        .setStyle(TextInputStyle.Paragraph)
        .setValue(config.settings.defaultMessage)
        .setMaxLength(500)
        .setRequired(true);

    const row = new ActionRowBuilder().addComponents(input);
    modal.addComponents(row);

    await interaction.showModal(modal);
}

async function handleConfigModal(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const config = await streamAlertSchema.findOne({
        guildId: interaction.guild.id
    });

    if (!config) {
        return interaction.editReply({ content: '❌ No hay configuración.' });
    }

    const modalType = interaction.customId.split('_')[3]; // interval o message

    if (modalType === 'interval') {
        const interval = parseInt(interaction.fields.getTextInputValue('interval'));

        if (isNaN(interval) || interval < 1 || interval > 60) {
            return interaction.editReply({
                content: '❌ El intervalo debe ser un número entre 1 y 60 minutos.'
            });
        }

        config.settings.checkInterval = interval;
        await config.save();

        // Reiniciar el monitor con el nuevo intervalo
        try {
            const { initializeStreamMonitor } = require('./streamMonitor');
            interaction.client._streamAlertMonitorInitialized = false;
            initializeStreamMonitor(interaction.client);
        } catch (error) {
            console.error('Error reiniciando monitor:', error);
            // Continuar aunque falle el reinicio
        }

        await interaction.editReply({
            content: `✅ Intervalo actualizado a **${interval} minutos**.\nEl sistema se reiniciará con el nuevo intervalo en la próxima verificación.`
        });

    } else if (modalType === 'message') {
        const message = interaction.fields.getTextInputValue('message');

        config.settings.defaultMessage = message;
        await config.save();

        await interaction.editReply({
            content: `✅ Mensaje por defecto actualizado:\n\`${message}\``
        });
    }
}

// ==================== API KEYS ====================

async function handleAPIButton(interaction) {
    const type = interaction.customId.split('_')[3]; // twitch
    const field = interaction.customId.split('_')[4]; // id o secret

    const modal = new ModalBuilder()
        .setCustomId(`sa_modal_api_${type}_${field}`)
        .setTitle(`Configurar ${type.toUpperCase()} ${field === 'id' ? 'Client ID' : 'Client Secret'}`);

    const input = new TextInputBuilder()
        .setCustomId('value')
        .setLabel(field === 'id' ? 'Client ID' : 'Client Secret')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder(field === 'id' ? 'abc123...' : 'xyz789...')
        .setRequired(true);

    const row = new ActionRowBuilder().addComponents(input);
    modal.addComponents(row);

    await interaction.showModal(modal);
}

async function handleAPIModal(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const config = await streamAlertSchema.findOne({
        guildId: interaction.guild.id
    });

    if (!config) {
        return interaction.editReply({ content: '❌ No hay configuración.' });
    }

    const type = interaction.customId.split('_')[3]; // twitch
    const field = interaction.customId.split('_')[4]; // id o secret
    const value = interaction.fields.getTextInputValue('value').trim();

    // Validar que el valor no esté vacío
    if (!value) {
        return interaction.editReply({
            content: '❌ El valor no puede estar vacío.'
        });
    }

    // Inicializar apiKeys si no existe
    if (!config.apiKeys) {
        config.apiKeys = {
            twitchClientId: null,
            twitchClientSecret: null
        };
    }

    if (type === 'twitch') {
        if (field === 'id') {
            config.apiKeys.twitchClientId = value;
            console.log(`[API] Configurando Twitch Client ID: ${value.substring(0, 10)}...`);
        } else if (field === 'secret') {
            config.apiKeys.twitchClientSecret = value;
            console.log(`[API] Configurando Twitch Client Secret: ${value.substring(0, 10)}...`);
        }
    }

    // Marcar el subdocumento como modificado para que Mongoose lo guarde
    config.markModified('apiKeys');
    
    await config.save();

    // Verificar que se guardó correctamente
    const verificar = await streamAlertSchema.findOne({ guildId: interaction.guild.id });
    console.log('[API] Verificación post-guardado:', {
        twitchClientId: verificar.apiKeys?.twitchClientId ? 'Configurado' : 'No configurado',
        twitchClientSecret: verificar.apiKeys?.twitchClientSecret ? 'Configurado' : 'No configurado'
    });

    const embed = new EmbedBuilder()
        .setColor('#00FF00')
        .setTitle('✅ API Key Configurada')
        .addFields(
            { name: 'Plataforma', value: type.toUpperCase(), inline: true },
            { name: 'Campo', value: field === 'id' ? 'Client ID' : 'Client Secret', inline: true },
            { name: 'Estado', value: '✅ Configurado', inline: true }
        )
        .setDescription('Usa `/streamalert test twitch <username>` para probar la conexión.')
        .setFooter({ text: 'Los datos se guardaron correctamente en la base de datos' })
        .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
}

// ==================== EDITAR STREAMER ====================

async function handleEditStreamer(interaction) {
    const streamerId = interaction.customId.split('_')[2];
    const option = interaction.values[0];

    const config = await streamAlertSchema.findOne({
        guildId: interaction.guild.id
    });

    if (!config) {
        return interaction.reply({
            content: '❌ No hay configuración.',
            ephemeral: true
        });
    }

    const streamer = config.streamers.find(s => s.streamerId === streamerId);

    if (!streamer) {
        return interaction.reply({
            content: '❌ Streamer no encontrado.',
            ephemeral: true
        });
    }

    const modal = new ModalBuilder()
        .setCustomId(`sa_modal_edit_${streamerId}_${option}`)
        .setTitle('Editar Streamer');

    let input;

    switch (option) {
        case 'displayname':
            input = new TextInputBuilder()
                .setCustomId('value')
                .setLabel('Nombre de Display')
                .setStyle(TextInputStyle.Short)
                .setValue(streamer.displayName)
                .setRequired(true);
            break;
        case 'role':
            input = new TextInputBuilder()
                .setCustomId('value')
                .setLabel('ID del Rol (o "ninguno" para quitar)')
                .setStyle(TextInputStyle.Short)
                .setValue(streamer.roleId || 'ninguno')
                .setRequired(true);
            break;
        case 'message':
            input = new TextInputBuilder()
                .setCustomId('value')
                .setLabel('Mensaje Personalizado')
                .setStyle(TextInputStyle.Paragraph)
                .setValue(streamer.customMessage || '')
                .setPlaceholder('Usa {streamer} para el nombre')
                .setRequired(false);
            break;
    }

    const row = new ActionRowBuilder().addComponents(input);
    modal.addComponents(row);

    await interaction.showModal(modal);
}

async function handleEditStreamerModal(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const [, , , streamerId, field] = interaction.customId.split('_');
    const value = interaction.fields.getTextInputValue('value');

    const config = await streamAlertSchema.findOne({
        guildId: interaction.guild.id
    });

    if (!config) {
        return interaction.editReply({ content: '❌ No hay configuración.' });
    }

    const streamer = config.streamers.find(s => s.streamerId === streamerId);

    if (!streamer) {
        return interaction.editReply({ content: '❌ Streamer no encontrado.' });
    }

    switch (field) {
        case 'displayname':
            streamer.displayName = value;
            break;
        case 'role':
            if (value.toLowerCase() === 'ninguno' || value === '') {
                streamer.roleId = null;
            } else {
                // Validar que el rol existe
                const role = interaction.guild.roles.cache.get(value);
                if (!role) {
                    return interaction.editReply({
                        content: '❌ Rol no válido. Usa el ID del rol o escribe "ninguno".'
                    });
                }
                streamer.roleId = value;
            }
            break;
        case 'message':
            streamer.customMessage = value || null;
            break;
    }

    await config.save();

    const embed = new EmbedBuilder()
        .setColor('#00FF00')
        .setTitle('✅ Streamer Actualizado')
        .addFields(
            { name: '👤 Streamer', value: streamer.displayName, inline: true },
            { name: '🔧 Campo', value: field, inline: true },
            { name: '✅ Nuevo Valor', value: value || 'Ninguno', inline: true }
        )
        .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
}