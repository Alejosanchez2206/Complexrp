// events/customCommandModal.js
const { Events, EmbedBuilder } = require('discord.js');
const customCommand = require('../../Models/customCommand');

module.exports = {
    name: Events.InteractionCreate,
    once: false,

    /**
     * @param {import('discord.js').Interaction} interaction
     * @param {import('discord.js').Client} client
     */
    async execute(interaction, client) {
        // Solo procesar modal submits
        if (!interaction.isModalSubmit()) return;

        // Solo procesar modales de comandos personalizados
        if (!interaction.customId.startsWith('custom_command_')) return;

        try {
            const [, , tipo, accion, ...commandNameParts] = interaction.customId.split('_');
            const commandName = commandNameParts.join('_');

            if (tipo === 'texto') {
                await handleTextoModal(interaction, commandName, accion);
            } else if (tipo === 'embed') {
                await handleEmbedModal(interaction, commandName, accion);
            }

        } catch (error) {
            console.error('Error procesando modal de comando personalizado:', error);
            
            const errorMessage = {
                content: '❌ Error al procesar el comando personalizado.',
                ephemeral: true
            };

            try {
                if (interaction.replied || interaction.deferred) {
                    await interaction.editReply(errorMessage);
                } else {
                    await interaction.reply(errorMessage);
                }
            } catch (replyError) {
                console.error('Error al responder:', replyError);
            }
        }
    }
};

/**
 * Maneja modal de tipo texto
 */
async function handleTextoModal(interaction, commandName, accion) {
    const response = interaction.fields.getTextInputValue('response');

    if (accion === 'crear') {
        await customCommand.create({
            guildId: interaction.guild.id,
            commandName: commandName,
            tipo: 'texto',
            response: response,
            createdBy: interaction.user.id
        });

        const embed = new EmbedBuilder()
            .setColor('#00ff00')
            .setTitle('✅ Comando Creado')
            .setDescription(`El comando \`${commandName}\` ha sido creado exitosamente.`)
            .addFields(
                {
                    name: 'Tipo',
                    value: '📝 Texto Simple',
                    inline: true
                },
                {
                    name: 'Nombre del Comando',
                    value: `\`${commandName}\``,
                    inline: true
                },
                {
                    name: 'Respuesta',
                    value: response.length > 1024 ? response.slice(0, 1021) + '...' : response,
                    inline: false
                }
            )
            .setFooter({
                text: `Creado por ${interaction.user.tag}`,
                iconURL: interaction.user.displayAvatarURL()
            })
            .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: true });

        console.log(`✅ Comando personalizado creado: ${commandName} (texto) por ${interaction.user.tag}`);

    } else if (accion === 'editar') {
        const updated = await customCommand.findOneAndUpdate(
            {
                guildId: interaction.guild.id,
                commandName: commandName
            },
            {
                response: response,
                updatedAt: Date.now()
            },
            { new: true }
        );

        if (!updated) {
            return interaction.reply({
                content: `❌ No se encontró el comando \`${commandName}\`.`,
                ephemeral: true
            });
        }

        const embed = new EmbedBuilder()
            .setColor('#ffa500')
            .setTitle('✏️ Comando Actualizado')
            .setDescription(`El comando \`${commandName}\` ha sido actualizado exitosamente.`)
            .addFields(
                {
                    name: 'Tipo',
                    value: '📝 Texto Simple',
                    inline: true
                },
                {
                    name: 'Nombre del Comando',
                    value: `\`${commandName}\``,
                    inline: true
                },
                {
                    name: 'Nueva Respuesta',
                    value: response.length > 1024 ? response.slice(0, 1021) + '...' : response,
                    inline: false
                }
            )
            .setFooter({
                text: `Actualizado por ${interaction.user.tag}`,
                iconURL: interaction.user.displayAvatarURL()
            })
            .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: true });

        console.log(`✏️ Comando personalizado actualizado: ${commandName} por ${interaction.user.tag}`);
    }
}

/**
 * Maneja modal de tipo embed
 */
async function handleEmbedModal(interaction, commandName, accion) {
    const title = interaction.fields.getTextInputValue('title') || null;
    const description = interaction.fields.getTextInputValue('description');
    const color = interaction.fields.getTextInputValue('color') || '#0099ff';
    const footer = interaction.fields.getTextInputValue('footer') || null;
    const image = interaction.fields.getTextInputValue('image') || null;

    // Validar color hex
    const hexRegex = /^#[0-9A-Fa-f]{6}$/;
    if (!hexRegex.test(color)) {
        return interaction.reply({
            content: '❌ Color inválido. Usa formato hexadecimal (ej: #0099ff)',
            ephemeral: true
        });
    }

    // Validar URL de imagen si se proporcionó
    if (image && !isValidUrl(image)) {
        return interaction.reply({
            content: '❌ URL de imagen inválida. Debe ser una URL válida (http/https).',
            ephemeral: true
        });
    }

    const embedData = {
        title,
        description,
        color,
        footer,
        image
    };

    if (accion === 'crear') {
        await customCommand.create({
            guildId: interaction.guild.id,
            commandName: commandName,
            tipo: 'embed',
            embedData: embedData,
            createdBy: interaction.user.id
        });

        // Crear embed de vista previa
        const previewEmbed = new EmbedBuilder()
            .setColor(color)
            .setDescription(description);

        if (title) previewEmbed.setTitle(title);
        if (footer) previewEmbed.setFooter({ text: footer });
        if (image) previewEmbed.setImage(image);
        previewEmbed.setTimestamp();

        // Embed de confirmación
        const confirmEmbed = new EmbedBuilder()
            .setColor('#00ff00')
            .setTitle('✅ Comando Embed Creado')
            .setDescription(`El comando \`${commandName}\` ha sido creado exitosamente.`)
            .addFields(
                {
                    name: 'Tipo',
                    value: '📋 Embed',
                    inline: true
                },
                {
                    name: 'Nombre del Comando',
                    value: `\`${commandName}\``,
                    inline: true
                }
            )
            .setFooter({
                text: `Creado por ${interaction.user.tag}`,
                iconURL: interaction.user.displayAvatarURL()
            })
            .setTimestamp();

        await interaction.reply({
            content: '**Vista previa del embed:**',
            embeds: [confirmEmbed, previewEmbed],
            ephemeral: true
        });

        console.log(`✅ Comando personalizado creado: ${commandName} (embed) por ${interaction.user.tag}`);

    } else if (accion === 'editar') {
        const updated = await customCommand.findOneAndUpdate(
            {
                guildId: interaction.guild.id,
                commandName: commandName
            },
            {
                embedData: embedData,
                updatedAt: Date.now()
            },
            { new: true }
        );

        if (!updated) {
            return interaction.reply({
                content: `❌ No se encontró el comando \`${commandName}\`.`,
                ephemeral: true
            });
        }

        // Crear embed de vista previa
        const previewEmbed = new EmbedBuilder()
            .setColor(color)
            .setDescription(description);

        if (title) previewEmbed.setTitle(title);
        if (footer) previewEmbed.setFooter({ text: footer });
        if (image) previewEmbed.setImage(image);
        previewEmbed.setTimestamp();

        // Embed de confirmación
        const confirmEmbed = new EmbedBuilder()
            .setColor('#ffa500')
            .setTitle('✏️ Comando Embed Actualizado')
            .setDescription(`El comando \`${commandName}\` ha sido actualizado exitosamente.`)
            .addFields(
                {
                    name: 'Tipo',
                    value: '📋 Embed',
                    inline: true
                },
                {
                    name: 'Nombre del Comando',
                    value: `\`${commandName}\``,
                    inline: true
                }
            )
            .setFooter({
                text: `Actualizado por ${interaction.user.tag}`,
                iconURL: interaction.user.displayAvatarURL()
            })
            .setTimestamp();

        await interaction.reply({
            content: '**Vista previa del embed actualizado:**',
            embeds: [confirmEmbed, previewEmbed],
            ephemeral: true
        });

        console.log(`✏️ Comando personalizado actualizado: ${commandName} por ${interaction.user.tag}`);
    }
}

/**
 * Valida si una URL es válida
 */
function isValidUrl(url) {
    try {
        const urlObj = new URL(url);
        return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
    } catch (error) {
        return false;
    }
}