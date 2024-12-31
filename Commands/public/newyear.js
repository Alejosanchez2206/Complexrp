const {
    SlashCommandBuilder,
    AttachmentBuilder
} = require('discord.js');
const { createCanvas, loadImage } = require('canvas');
const path = require('path');
const fs = require('fs');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('newyear')
        .setDescription('Muestra una imagen de new year'),
    /**
     * @param {ChatInputCommandInteraction} interation
     * @param {Client} client 
     */
    async execute(interaction, client) {
        try {
            const canvas = createCanvas(900, 400);
            const ctx = canvas.getContext('2d');

            // Cargar la imagen de fondo
            const backgroundImage = await loadImage(path.join(__dirname, '..', '..', 'Assets', 'Banground.png'));

            // Dibujar la imagen de fondo en el lienzo
            ctx.drawImage(backgroundImage, 0, 0, canvas.width, canvas.height);


            const userNamer = (interaction.user.username).toUpperCase();
            ctx.font = 'bold 20px "Segoe Script"';
            ctx.fillStyle = '#FFFFFF';
            ctx.textAlign = 'center';
            ctx.fillText(userNamer, 710, 330);

            //Dibujar la imagen del user en el lienzo
            const userImage = await loadImage(interaction.user.displayAvatarURL({ size: 1024, extension: 'png' }));
            ctx.beginPath();
            ctx.arc(710, 193, 100, 0, 2 * Math.PI);
            ctx.clip();
            ctx.drawImage(userImage, 610, 93, 200, 200);


            const attachment = new AttachmentBuilder(canvas.toBuffer(), { name: 'newyear.png' });
            interaction.reply({ files: [attachment], ephemeral: true });
        } catch (error) {
            console.log(error);
            interaction.reply({ content: `Ocurrio un error al ejecutar el comando ${interaction.commandName}`, ephemeral: true });
        }
    }
}