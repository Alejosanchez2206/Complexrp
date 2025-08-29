const {
    SlashCommandBuilder,
    Client,
    PermissionFlagsBits,
    ChatInputCommandInteraction,
    ChannelType
} = require('discord.js');

const permisosEspecialSchema = require('../../Models/permisosEspecial');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('purge-user')
        .setDescription('Elimina todos los mensajes de un usuario en las últimas 24 horas')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addUserOption(option =>
            option.setName('usuario')
                .setDescription('Usuario cuyos mensajes serán eliminados')
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

            await interaction.deferReply({ ephemeral: true });

            const targetUser = interaction.options.getUser('usuario');
            const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

            let totalDeleted = 0;
            const textChannels = interaction.guild.channels.cache.filter(channel => channel.type === ChannelType.GuildText);

            for (const channel of textChannels.values()) {
                try {
                    const messages = await channel.messages.fetch({ limit: 100 });
                    const userMessages = messages.filter(msg => 
                        msg.author.id === targetUser.id && 
                        msg.createdTimestamp > twentyFourHoursAgo.getTime()
                    );

                    for (const message of userMessages.values()) {
                        await message.delete();
                        totalDeleted++;
                    }
                } catch (channelError) {
                    console.error(`Error en el canal ${channel.name}:`, channelError);
                    continue;
                }
            }

            await interaction.editReply({ 
                content: `Se eliminaron ${totalDeleted} mensajes de ${targetUser.tag} enviados en las últimas 24 horas.`,
                ephemeral: true 
            });

        } catch (error) {
            console.error('Error al ejecutar el comando purge-user:', error);
            await interaction.editReply({ 
                content: 'Ocurrió un error al ejecutar el comando. Por favor, intenta de nuevo.',
                ephemeral: true 
            });
        }
    }
};