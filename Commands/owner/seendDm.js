const {
    SlashCommandBuilder,
    Client,
    PermissionFlagsBits,
    ChatInputCommandInteraction,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ActionRowBuilder,
    EmbedBuilder
} = require('discord.js');

const permisosEspecialSchema = require('../../Models/permisosEspecial');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('announce-to-role')
        .setDescription('Envía un anuncio a los DMs de usuarios con un rol específico vía un formulario')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addRoleOption(option =>
            option.setName('rol')
                .setDescription('Rol al que se enviará el anuncio')
                .setRequired(true)
        ),

    /**
     * @param {ChatInputCommandInteraction} interaction
     * @param {Client} client
     * @returns {Promise<void>}
     */
    async execute(interaction, client) {
        try {
            if (!interaction.guild) return;
            if (!interaction.isChatInputCommand()) return;

            // Validate special permissions
            const validarEspecial = await permisosEspecialSchema.findOne({ 
                guildServidor: interaction.guild.id, 
                guildUsuario: interaction.user.id 
            });

            if (!validarEspecial) {
                return interaction.reply({ 
                    content: 'No tienes permisos especiales para usar este comando', 
                    ephemeral: true 
                });
            }

            // Create modal for announcement message
            const modal = new ModalBuilder()
                .setCustomId('announceModal')
                .setTitle('Formulario de Anuncio');

            // Create text input for announcement
            const announcementInput = new TextInputBuilder()
                .setCustomId('anuncio')
                .setLabel('Mensaje del Anuncio')
                .setStyle(TextInputStyle.Paragraph)
                .setPlaceholder('Ingresa el mensaje a enviar')
                .setRequired(true);

            // Add input to modal
            modal.addComponents(
                new ActionRowBuilder().addComponents(announcementInput)
            );

            // Show modal
            await interaction.showModal(modal);

            // Handle modal submission
            const filter = i => i.customId === 'announceModal' && i.user.id === interaction.user.id;
            const modalInteraction = await interaction.awaitModalSubmit({ filter, time: 300000 }).catch(error => {
                console.error('Error en la espera del modal:', error);
                return null;
            });

            if (!modalInteraction) {
                return interaction.followUp({ 
                    content: 'Tiempo de espera agotado para el formulario.', 
                    ephemeral: true 
                });
            }

            await modalInteraction.deferReply({ ephemeral: true });

            const role = interaction.options.getRole('rol');
            const announcement = modalInteraction.fields.getTextInputValue('anuncio');

            // Fetch members with the role
            const members = await interaction.guild.members.fetch();
            const roleMembers = members.filter(member => member.roles.cache.has(role.id));

            if (roleMembers.size === 0) {
                return modalInteraction.editReply({ 
                    content: `No hay usuarios con el rol ${role.name}.`, 
                    ephemeral: true 
                });
            }

            // Alert channel
            const alertChannelId = '1358551779196932257'; // Your provided channel ID
            const alertChannel = interaction.guild.channels.cache.get(alertChannelId);
            if (!alertChannel) {
                return modalInteraction.editReply({ 
                    content: 'El canal de alertas no está configurado correctamente.', 
                    ephemeral: true 
                });
            }

            let sentCount = 0;
            let failedCount = 0;
            const failedUsers = [];

            // Send DMs to members
            for (const member of roleMembers.values()) {
                try {
                    await member.send(announcement);
                    sentCount++;
                } catch (dmError) {
                    console.error(`Error al enviar DM a ${member.user.tag}:`);
                    failedUsers.push(member.user.tag);
                    failedCount++;
                }
            }

            // Send alert for failed DMs
            if (failedUsers.length > 0) {
                const alertEmbed = new EmbedBuilder()
                    .setTitle('Alerta: DMs no enviados')
                    .setDescription(`No se pudo enviar el anuncio a los siguientes usuarios con el rol ${role.name} debido a DMs cerrados u otros errores:\n${failedUsers.join('\n').substring(0, 1000)}`)
                    .setColor('#FF0000')
                    .setTimestamp();
                await alertChannel.send({ embeds: [alertEmbed] });
            }

            // Reply with summary
            await modalInteraction.editReply({
                content: `Anuncio enviado a ${sentCount} usuarios con el rol ${role.name}. ${failedCount > 0 ? `${failedCount} usuarios no recibieron el mensaje (ver canal de alertas).` : 'Todos los mensajes se enviaron correctamente.'}`,
                ephemeral: true
            });

        } catch (error) {
            console.error('Error al ejecutar el comando announce-to-role:', error);
            await interaction.followUp({ 
                content: 'Ocurrió un error al ejecutar el comando. Por favor, intenta de nuevo.',
                ephemeral: true 
            });
        }
    }
};