const { AttachmentBuilder, EmbedBuilder } = require('discord.js');
const { createCanvas, loadImage } = require('canvas');
const path = require('path');
const fs = require('fs');
const concecutivoWhitelist = require('../../Models/concecutivoWhitelist');
const whitelistSchema = require('../../Models/whitelistSystemSchema');
const permisosSchema = require('../../Models/addPermisos');

module.exports = {
    name: 'interactionCreate',
    async execute(interaction) {
        try {
            if (!interaction.isButton()) return;

            if (interaction.customId === 'WhitelistSystemAccept') {
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
                const username = dataUser.user.username;
                const avatar = dataUser.user.displayAvatarURL({ size: 1024, extension: 'png' });
                const whitelist = await whitelistSchema.findOne({ guildId: interaction.guild.id });
                const concecutivo = await concecutivoWhitelist.findOne({ guildId: interaction.guild.id });

                let numberConsecutivo = 0;

                if (!concecutivo) {
                    await concecutivoWhitelist.create({ guildId: interaction.guild.id, numberConsecutivo: 1 });
                    numberConsecutivo = 1;
                } else {
                    await concecutivo.updateOne({ numberConsecutivo: concecutivo.numberConsecutivo + 1 });
                    numberConsecutivo = concecutivo.numberConsecutivo + 1;
                }

                if (!whitelist) return interaction.reply({ content: 'No se ha configurado un sistema de whitelist.', ephemeral: true });

                // Configuración del lienzo
                const canvas = createCanvas(800, 400);
                const ctx = canvas.getContext('2d');

                // Imagen de fondo
                const imagePath = path.join(__dirname, '../../Assets/Fondo1.png');
                const background = await loadImage(imagePath);
                ctx.drawImage(background, 0, 0, canvas.width, canvas.height);

                // Texto en el lienzo
                ctx.font = 'bold 40px Arial';
                ctx.fillStyle = '#000';
                ctx.fillText('IDENTIFICACIÓN', 30, 80);

                ctx.font = '28px Arial';
                ctx.fillStyle = '#000';
                ctx.fillText('JUGADOR:', 20, 130);
                ctx.fillText(username.toUpperCase(), 170, 130);

                ctx.font = 'bold 25px Arial';
                ctx.fillText(numberConsecutivo, 90, 160);

                ctx.font = '20px Arial';
                ctx.fillText('ORIGEN: DESCONOCIDO', 30, 220);
                ctx.fillText('DESTINO: COMPLEX COMMUNITY', 30, 260);

                const date = new Date();
                ctx.fillText(`LLEGADA: ${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`, 30, 300);

                const profileImage = await loadImage(avatar);
                ctx.drawImage(profileImage, 500, 50, 250, 250);

                ctx.font = '15px Arial';
                ctx.fillText('COMPLEX COMMUNITY', 30, 380);
                ctx.fillText('GTAV', 350, 380);
                ctx.fillText('WHITELIST APROBADA', 500, 380);

                const attachment = new AttachmentBuilder(canvas.toBuffer('image/png'), { name: 'tarjeta.png' });

                // Verificar que la interacción no se haya respondido previamente
                if (!interaction.replied && !interaction.deferred) {
                    // Crear un nuevo embed basado en el original y cambiar el color
                    const updatedEmbed = new EmbedBuilder(embed)
                        .setTitle('Whitelist Aprobada')
                        .setColor('#00FF00')
                        .setFooter({ text: 'Aprobad@ por: ' + interaction.user.username, iconURL: interaction.user.displayAvatarURL() });

                    // Actualizar el mensaje original con el nuevo embed
                    await interaction.message.edit({ embeds: [updatedEmbed], components: [] });

                    const channel = interaction.guild.channels.cache.get(whitelist.channelResult);
                    await channel.send({ content: `<@${id}> Bienvenido a ${interaction.guild.name}, Whitelist aprobada!`, files: [attachment] });

                } else {
                    console.log('La interacción ya ha sido respondida o no es válida.');
                }
            }
        } catch (err) {
            console.log('Error:', err);
        }
    }
};
