// events/customCommandButtons.js
const { Events, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
const customCommand = require('../../Models/customCommand');

module.exports = {
    name: Events.InteractionCreate,
    once: false,

    async execute(interaction, client) {
        if (!interaction.isButton()) return;

        // Solo procesar botones de custom commands
        if (!interaction.customId.startsWith('create_modal_') && !interaction.customId.startsWith('edit_modal_')) return;

        try {
            const [action, modal, tipo, ...commandNameParts] = interaction.customId.split('_');
            const commandName = commandNameParts.join('_');
            const isEdit = action === 'edit';

            // Buscar comando existente si es edición
            let existingCommand = null;
            if (isEdit) {
                existingCommand = await customCommand.findOne({
                    guildId: interaction.guild.id,
                    commandName: commandName
                });

                if (!existingCommand) {
                    return interaction.reply({
                        content: '❌ El comando ya no existe.',
                        ephemeral: true
                    });
                }
            }

            // Crear y mostrar modal
            if (tipo === 'texto') {
                await showModalTexto(interaction, commandName, isEdit ? 'editar' : 'crear', existingCommand);
            } else if (tipo === 'embed') {
                await showModalEmbed(interaction, commandName, isEdit ? 'editar' : 'crear', existingCommand);
            }

        } catch (error) {
            console.error('Error en customCommandButtons:', error);
            
            try {
                await interaction.reply({
                    content: '❌ Error al abrir el formulario.',
                    ephemeral: true
                }).catch(() => {});
            } catch (e) {
                console.error('Error al responder:', e);
            }
        }
    }
};

async function showModalTexto(interaction, commandName, accion, existingCommand = null) {
    const modal = new ModalBuilder()
        .setCustomId(`custom_command_texto_${accion}_${commandName}`)
        .setTitle(`${accion === 'crear' ? 'Crear' : 'Editar'} Comando: ${commandName}`);

    const responseInput = new TextInputBuilder()
        .setCustomId('response')
        .setLabel('Respuesta del Comando')
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder('Variables: {user}, {username}, {server}, {channel}')
        .setRequired(true)
        .setMinLength(1)
        .setMaxLength(2000);

    if (existingCommand?.response) {
        responseInput.setValue(existingCommand.response);
    }

    const row = new ActionRowBuilder().addComponents(responseInput);
    modal.addComponents(row);

    await interaction.showModal(modal);
}

async function showModalEmbed(interaction, commandName, accion, existingCommand = null) {
    const modal = new ModalBuilder()
        .setCustomId(`custom_command_embed_${accion}_${commandName}`)
        .setTitle(`${accion === 'crear' ? 'Crear' : 'Editar'} Embed: ${commandName}`);

    const titleInput = new TextInputBuilder()
        .setCustomId('title')
        .setLabel('Título (Opcional)')
        .setStyle(TextInputStyle.Short)
        .setRequired(false)
        .setMaxLength(256);

    const descriptionInput = new TextInputBuilder()
        .setCustomId('description')
        .setLabel('Descripción')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
        .setMinLength(1)
        .setMaxLength(4000);

    const colorInput = new TextInputBuilder()
        .setCustomId('color')
        .setLabel('Color (#RRGGBB)')
        .setStyle(TextInputStyle.Short)
        .setRequired(false)
        .setMinLength(7)
        .setMaxLength(7)
        .setValue(existingCommand?.embedData?.color || '#0099ff');

    const footerInput = new TextInputBuilder()
        .setCustomId('footer')
        .setLabel('Footer (Opcional)')
        .setStyle(TextInputStyle.Short)
        .setRequired(false)
        .setMaxLength(2048);

    const imageInput = new TextInputBuilder()
        .setCustomId('image')
        .setLabel('URL Imagen (Opcional)')
        .setStyle(TextInputStyle.Short)
        .setRequired(false)
        .setMaxLength(500);

    if (existingCommand?.embedData) {
        if (existingCommand.embedData.title) titleInput.setValue(existingCommand.embedData.title);
        if (existingCommand.embedData.description) descriptionInput.setValue(existingCommand.embedData.description);
        if (existingCommand.embedData.footer) footerInput.setValue(existingCommand.embedData.footer);
        if (existingCommand.embedData.image) imageInput.setValue(existingCommand.embedData.image);
    }

    modal.addComponents(
        new ActionRowBuilder().addComponents(titleInput),
        new ActionRowBuilder().addComponents(descriptionInput),
        new ActionRowBuilder().addComponents(colorInput),
        new ActionRowBuilder().addComponents(footerInput),
        new ActionRowBuilder().addComponents(imageInput)
    );

    await interaction.showModal(modal);
}