const {
    SlashCommandBuilder,
    Client,
    ChatInputCommandInteraction,
    EmbedBuilder,
    PermissionFlagsBits
} = require('discord.js');

const whitelistInvitacionesSchema = require('../../Models/whitelistInvitacion');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('redeem-invitacion')
        .setDescription('Reedem Whitelist')
        .addStringOption(option =>
            option.setName('code')
                .setDescription('Code')
                .setRequired(true)
        ),
    /** 
    * @param {ChatInputCommandInteraction} interaction
    * @param {Client} client
    * @returns {Promise<void>}
    *      
    */

    async execute(interaction, client) {
        const code = interaction.options.getString('code');
        const userId = interaction.user.id;
        const guildId = interaction.guild.id;

        const rolesUser = interaction.member.roles.cache.map(role => role.id).join(',');
        const rolesArray = rolesUser.split(',');

        if (rolesArray.includes('1310750290370101369')) {
            return interaction.reply({ content: 'No tienes permisos para obtener invitaciones, porque tu whitelist fue dada por una invitacion de otro usuario', ephemeral: true });
        }

        const DateNow = new Date();
        const startOfMonth = new Date(DateNow.getFullYear(), DateNow.getMonth(), 1, 0, 0, 0, 0);
        const endOfMonth = new Date(DateNow.getFullYear(), DateNow.getMonth() + 1, 0, 23, 59, 59, 999);


        const whitelist = await whitelistInvitacionesSchema.findOne({ guildId, codeWl: code, codeDate: { $ne: null, $gte: startOfMonth, $lte: endOfMonth } });

        if (!whitelist) {
            return interaction.reply({ content: 'No tienes invitaciones disponibles, si crees que es un error contacta con los Supervisores', ephemeral: true });
        }

        if (whitelist.CodeRemdeem === 2) {
            return interaction.reply({ content: 'Este codigo ya no esta disponible , si crees que es un error contacta con los Supervisores', ephemeral: true });
        }

        const logsChannel = client.channels.cache.get('1365745887225053336');
        if (!logsChannel) return interaction.reply({ content: 'Error al enviar el mensaje.', ephemeral: true });

        await whitelistInvitacionesSchema.findOneAndUpdate(
            { guildId, codeWl: code },
            {
                $set: {
                    CodeRemdeem: whitelist.CodeRemdeem + 1,
                    codeDate: DateNow,
                },
                $push: {
                    history: {
                        userId: userId,
                        codeDate: DateNow,
                        codeWl: code
                    }
                }
            }
        );

        // add role to user
        const member = interaction.guild.members.cache.get(userId);
        if (!member) return interaction.reply({ content: '❌ Usuario no encontrado.', ephemeral: true });
        await member.roles.add(['1310750290370101369', '1351573046410084476']);


        const embed = new EmbedBuilder()
            .setTitle('🎟️ Invitacion de whitelist')
            .addFields(
                { name: 'Usuario', value: `<@${userId}>`, inline: false },
                { name: 'Codigo de invitacion', value: `${code}`, inline: false },
                { name: 'Fecha de uso', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: false },
                { name: 'Invitado por', value: `<@${whitelist.userId}>`, inline: false },
                { name: 'Usos restantes', value: `${whitelist.CodeRemdeem === 0 ? whitelist.codeUse - 1 : whitelist.codeUse - whitelist.CodeRemdeem}`, inline: false },
            )
            .setColor('#00FF00')
            .setFooter({ text: 'Complex Community', iconURL: interaction.guild.iconURL() })
            .setTimestamp();

        await logsChannel.send({ embeds: [embed] });

        return interaction.reply({ content: 'Whitelist activada', ephemeral: true });

    }
}