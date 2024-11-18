const verifySchema = require('../../Models/verifySchema');

module.exports = {
    name: 'interactionCreate',
    async execute(interaction) {
        if (interaction.customId === 'verifySystem' && interaction.isButton()) {
            const data = await verifySchema.findOne({ guildId: interaction.guild.id });

            if (!data) return interaction.reply({ content: '❌ No se ha configurado un sistema de verificación.', ephemeral: true });

            const role = interaction.guild.roles.cache.get(data.roleId);

            const rolesUser = interaction.member.roles.cache.map(role => role.id).join(',');

            const rolesArray = rolesUser.split(',');

            if (rolesArray.includes(data.roleId)) return interaction.reply({ content: '❌ Ya has sido verificado.', ephemeral: true });

            const member = interaction.guild.members.cache.get(interaction.user.id);
            await member.roles.add(role);
            const channel = interaction.guild.channels.cache.get('1300173064910147789');
            await channel.send({ content: `Felicitaciones <@${interaction.user.id}> Has obtenido la whitelist en nuestro servidor , te esperamos con amsias el dia de la apertura.` });
            await interaction.reply({ content: '✅ Has sido verificado.', ephemeral: true });
        }
    }
}