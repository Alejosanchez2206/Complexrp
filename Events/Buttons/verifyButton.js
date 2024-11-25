const {
    AttachmentBuilder
} = require('discord.js');

const {
    createCanvas,
    loadImage
} = require('canvas');

const path = require('path');
const fs = require('fs');
const verifySchema = require('../../Models/verifySchema');
const concecutivoWhitelist = require('../../Models/concecutivoWhitelist');
module.exports = {
    name: 'interactionCreate',
    async execute(interaction) {
        try {
            if (interaction.customId === 'verifySystem' && interaction.isButton()) {
                await interaction.deferReply({ ephemeral: true });

                const avatar = interaction.member.user.displayAvatarURL({ size: 1024, extension: 'png' });
                const username = interaction.member.user.username;

                const data = await verifySchema.findOne({ guildId: interaction.guild.id });

                if (!data) return interaction.followUp({ content: '❌ No se ha configurado un sistema de verificación.', ephemeral: true });

                const role = interaction.guild.roles.cache.get(data.roleId);

                const rolesUser = interaction.member.roles.cache.map(role => role.id).join(',');
                const rolesArray = rolesUser.split(',');

                if (rolesArray.includes(data.roleId)) return interaction.followUp({ content: '❌ Ya has sido verificado.', ephemeral: true });

                const member = interaction.guild.members.cache.get(interaction.user.id);
                await member.roles.add(role);

                const concecutivo = await concecutivoWhitelist.findOne({ guildId: interaction.guild.id });
                let consecutivoNumberActual = 0;
                if (concecutivo) {
                    await concecutivo.updateOne({ numberConsecutivo: concecutivo.numberConsecutivo + 1 });
                    consecutivoNumberActual = concecutivo.numberConsecutivo + 1;
                } else {
                    await concecutivoWhitelist.create({ guildId: interaction.guild.id, numberConsecutivo: 1 });
                    consecutivoNumberActual = 1;
                }

                // Configuración de lienzo 
                const canvas = createCanvas(800, 400);
                const ctx = canvas.getContext('2d');

                // Imagen de fondo
                const imagePath = path.join(__dirname, '../../Assets/Fondo1.png');
                const background = await loadImage(imagePath);
                ctx.drawImage(background, 0, 0, canvas.width, canvas.height);

                // Texto: Identificación 
                ctx.font = 'bold 40px Arial';
                ctx.fillStyle = '#000';
                ctx.fillText('IDENTIFICACIÓN', 30, 80);

                // Texto: Jugador
                ctx.font = '28px Arial';
                ctx.fillStyle = '#000';
                ctx.fillText('JUGADOR:', 20, 130);

                // Texto: Nombre
                ctx.font = 'bold 28px Arial';
                ctx.fillStyle = '#000';
                ctx.fillText(username.toUpperCase(), 170, 130);

                // Texto: Código
                ctx.font = 'bold 25px Arial';
                ctx.fillStyle = '#000';
                ctx.fillText(consecutivoNumberActual, 90, 160);

                // Texto: Origen y destino
                ctx.font = '20px Arial';
                ctx.fillStyle = '#000';
                ctx.fillText('ORIGEN: DESCONOCIDO', 30, 220);
                ctx.fillText('DESTINO: COMPLEX COMMUNITY', 30, 260);

                // Texto: Llegada
                const date = new Date();
                ctx.fillText(`LLEGADA: ${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`, 30, 300);

                const profileImage = await loadImage(avatar);
                ctx.drawImage(profileImage, 500, 50, 250, 250);

                // Texto: Footer
                ctx.font = '15px Arial';
                ctx.fillStyle = '#000';
                ctx.fillText('COMPLEX COMMUNITY', 30, 380);
                ctx.fillText('GTAV', 350, 380);
                ctx.fillText('WHITELIST APROBADA', 500, 380);

                const attachment = new AttachmentBuilder(canvas.toBuffer('image/png'), { name: 'tarjeta.png' });
                const channel = interaction.guild.channels.cache.get(data.channelId);
                await channel.send({ content: `<@${interaction.user.id}> Bienvenido a ${interaction.guild.name}, te esperamos el día de nuestra apertura`, files: [attachment] });
                await interaction.followUp({ content: '✅ Verificación exitosa.', ephemeral: true });
            }
        } catch (error) {
            console.log(error);
            if (!interaction.deferred && !interaction.replied) {
                await interaction.reply({ content: 'Error al enviar la verificación.', ephemeral: true });
            } else {
                await interaction.followUp({ content: 'Error al enviar la verificación.', ephemeral: true });
            }
        }
    }
};
