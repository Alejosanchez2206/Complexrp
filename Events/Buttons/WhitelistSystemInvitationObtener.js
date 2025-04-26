const { EmbedBuilder } = require('discord.js');
const whitelistInvitacionesSchema = require('../../Models/whitelistInvitacion');
const { generarId } = require('../../utils/idunique.js');

module.exports = {
    name: 'interactionCreate',
    once: false,
    async execute(interaction) {
        if (!interaction.isButton()) return;
        if (interaction.customId === 'WhitelistSystemInvitationObtener') {
            // Verificar que el usuario tiene el rol adecuado
            try {
                const rolesUser = interaction.member.roles.cache.map(role => role.id).join(',');
                const rolesArray = rolesUser.split(',');

                if (rolesArray.includes('1351573046410084476')) {
                    return interaction.reply({ content: 'No tienes permisos para obtener invitaciones, porque tu whitelist fue dada por una invitacion de otro usuario', ephemeral: true });
                }


                const idGenerado = generarId();
                const DateNow = new Date();
                const startOfMonth = new Date(DateNow.getFullYear(), DateNow.getMonth(), 1, 0, 0, 0, 0);
                const endOfMonth = new Date(DateNow.getFullYear(), DateNow.getMonth() + 1, 0, 23, 59, 59, 999);


             

                const whitelist = await whitelistInvitacionesSchema.find({
                    guildId: interaction.guild.id,
                    userId: interaction.user.id,
                    codeDate: { $ne: null, $gte: startOfMonth, $lte: endOfMonth }
                });

                if (whitelist.length > 0) {
                    return interaction.reply({ content: 'No tienes invitaciones disponibles, si crees que es un error contacta con los Supervisores', ephemeral: true });
                }


                await whitelistInvitacionesSchema.create({
                    guildId: interaction.guild.id,
                    userId: interaction.user.id,
                    codeWl: idGenerado,
                    codeUse: 2,
                    CodeRemdeem: 0,
                    codeDate: DateNow,
                    history: []
                });


                const embed = new EmbedBuilder()
                    .setTitle('🎟️ Invitación generada')
                    .setDescription(`Tu código de invitación es:\n\n\`\`\`${idGenerado}\`\`\`\n\nPuedes compartir este código con tus invitados.`)
                    .setColor('#00FF00')
                    .setFooter({ text: 'Complex Community', iconURL: interaction.guild.iconURL() })
                    .setTimestamp();
                await interaction.reply({ embeds: [embed], ephemeral: true });

            } catch (err) {
                console.log(err)
                return interaction.reply({ content: 'Error al obtener las invitaciones , si crees que es un error contacta con los Supervisores', ephemeral: true });
            }
        }
    }
}