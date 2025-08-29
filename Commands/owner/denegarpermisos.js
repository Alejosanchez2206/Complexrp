const {
    SlashCommandBuilder,
    Client,
    PermissionFlagsBits,
    ChatInputCommandInteraction,
    PermissionsBitField
} = require('discord.js');

const permisosEspecialSchema = require('../../Models/permisosEspecial');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('deny-everyone-permissions')
        .setDescription('Deniega todos los permisos al rol @everyone en todos los canales existentes')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

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

            await interaction.deferReply({ ephemeral: true });

            const everyoneRole = interaction.guild.roles.everyone;
            const allChannels = interaction.guild.channels.cache;

            let updatedChannels = 0;
            const errors = [];

            for (const channel of allChannels.values()) {
                try {
                    await channel.permissionOverwrites.edit(everyoneRole, {
                        // Deny all common permissions
                        ViewChannel: false,
                        SendMessages: false
                    });
                    updatedChannels++;
                } catch (channelError) {
                    console.error(`Error al actualizar permisos en el canal ${channel.name}:`, channelError);
                    errors.push(`Canal ${channel.name}: ${channelError.message}`);
                    continue;
                }
            }

            let replyContent = `Se actualizaron los permisos del rol @everyone en ${updatedChannels} canales.`;
            if (errors.length > 0) {
                replyContent += `\nErrores en ${errors.length} canales:\n${errors.join('\n').substring(0, 1000)}`;
            }

            await interaction.editReply({ 
                content: replyContent,
                ephemeral: true 
            });

        } catch (error) {
            console.error('Error al ejecutar el comando deny-everyone-permissions:', error);
            await interaction.editReply({ 
                content: 'Ocurrió un error al ejecutar el comando. Por favor, intenta de nuevo.',
                ephemeral: true 
            });
        }
    }
};