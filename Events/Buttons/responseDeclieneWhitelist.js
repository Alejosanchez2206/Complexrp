const { AttachmentBuilder, EmbedBuilder } = require('discord.js');
const whitelistSchema = require('../../Models/whitelistSystemSchema');
const permisosSchema = require('../../Models/addPermisos');
module.exports = {
    name: 'interactionCreate',
    async execute(interaction) {
        if (!interaction.isButton()) return;
        if (interaction.customId === 'WhitelistSystemDeclineButton') {

            // Verificar que el usuario tiene el rol adecuado
            const rolesUser = interaction.member.roles.cache.map(role => role.id).join(',');
            const rolesArray = rolesUser.split(',');
            const validarRol = await permisosSchema.find({ permiso: 'revisar-whitelist', guild: interaction.guild.id, rol: { $in: rolesArray } });

            if (validarRol.length === 0) {
                return interaction.reply({ content: 'No tienes permisos para responder whitelist, si crees que es un error contacta con los Supervisores', ephemeral: true });
            }

            const embed = interaction.message.embeds[0];
            const footer = embed.footer.text; // El texto del footer, e.g., "ID:672919914985816074"
            const id = footer.match(/\d+/)?.[0]; // Extraer solo los números usando una expresión regular

            const dataUser = await interaction.guild.members.fetch(id);
            if (!dataUser) return interaction.reply({ content: 'El usuario abandono el servidor.', ephemeral: true });
            const whitelist = await whitelistSchema.findOne({ guildId: interaction.guild.id });

            if (!whitelist) return interaction.reply({ content: 'No se ha configurado un sistema de whitelist.', ephemeral: true });

            const updatedEmbed = new EmbedBuilder(embed)
                .setTitle('Whitelist Rechazada')
                .setColor('#FF0000')
                .setFooter({ text: 'Rechazada por: ' + interaction.user.username, iconURL: interaction.user.displayAvatarURL() });

            // Actualizar el mensaje original con el nuevo embed
            await interaction.message.edit({ embeds: [updatedEmbed], components: [] });


            const channel = interaction.guild.channels.cache.get(whitelist.channelResult);
            await channel.send({ content: `❌ <@${id}> Lo sentimos, su solicitud de whitelist ha sido rechazada. ❌ , puedes volver a intentarlo. ⏲️` });
        }
    }
}

