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
                // Diferir la respuesta para tener más tiempo de procesamiento
                await interaction.deferUpdate();

                // Verificar que el usuario tiene el rol adecuado
                const rolesUser = interaction.member.roles.cache.map(role => role.id).join(',');
                const rolesArray = rolesUser.split(',');
                const validarRol = await permisosSchema.find({ 
                    permiso: 'revisar-whitelist', 
                    guild: interaction.guild.id, 
                    rol: { $in: rolesArray } 
                });

                if (validarRol.length === 0) {
                    return interaction.followUp({ 
                        content: 'No tienes permisos para responder whitelist, si crees que es un error contacta con los Supervisores', 
                        ephemeral: true 
                    });
                }

                // Validar que el mensaje tiene embeds
                if (!interaction.message.embeds || interaction.message.embeds.length === 0) {
                    return interaction.followUp({ 
                        content: 'No se pudo obtener la información del embed.', 
                        ephemeral: true 
                    });
                }

                const embed = interaction.message.embeds[0];
                
                // Validar que el embed tiene footer
                if (!embed.footer || !embed.footer.text) {
                    return interaction.followUp({ 
                        content: 'No se pudo obtener el ID del usuario desde el footer.', 
                        ephemeral: true 
                    });
                }

                const footer = embed.footer.text; // El texto del footer, e.g., "ID:672919914985816074"
                const idMatch = footer.match(/\d+/);
                
                if (!idMatch) {
                    return interaction.followUp({ 
                        content: 'No se pudo extraer el ID del usuario desde el footer.', 
                        ephemeral: true 
                    });
                }

                const id = idMatch[0];

                // Obtener información del usuario con manejo de errores
                let dataUser;
                try {
                    dataUser = await interaction.guild.members.fetch(id);
                } catch (error) {
                    console.log('Error al obtener el usuario:', error);
                    return interaction.followUp({ 
                        content: 'El usuario no se encuentra en el servidor o ha abandonado.', 
                        ephemeral: true 
                    });
                }

                if (!dataUser || !dataUser.user) {
                    return interaction.followUp({ 
                        content: 'No se pudo obtener la información del usuario.', 
                        ephemeral: true 
                    });
                }

                const username = dataUser.user.username;
                const avatar = dataUser.user.displayAvatarURL({ size: 1024, extension: 'png' });
                
                // Obtener configuración de whitelist
                const whitelist = await whitelistSchema.findOne({ guildId: interaction.guild.id });
                if (!whitelist) {
                    return interaction.followUp({ 
                        content: 'No se ha configurado un sistema de whitelist.', 
                        ephemeral: true 
                    });
                }

                // Manejar consecutivo
                let concecutivo = await concecutivoWhitelist.findOne({ guildId: interaction.guild.id });
                let numberConsecutivo = 0;

                if (!concecutivo) {
                    const newConcecutivo = await concecutivoWhitelist.create({ 
                        guildId: interaction.guild.id, 
                        numberConsecutivo: 1 
                    });
                    numberConsecutivo = 1;
                } else {
                    numberConsecutivo = concecutivo.numberConsecutivo + 1;
                    await concecutivoWhitelist.findByIdAndUpdate(concecutivo._id, { 
                        numberConsecutivo: numberConsecutivo 
                    });
                }

                // Validar que el archivo de imagen de fondo existe
                const imagePath = path.join(__dirname, '../../Assets/Fondo1.png');
                if (!fs.existsSync(imagePath)) {
                    console.log('Advertencia: No se encontró el archivo de fondo:', imagePath);
                    return interaction.followUp({ 
                        content: 'Error: No se encontró el archivo de imagen de fondo.', 
                        ephemeral: true 
                    });
                }

                // Crear el canvas con manejo de errores
                let canvas, ctx, attachment;
                try {
                    // Configuración del lienzo
                    canvas = createCanvas(800, 400);
                    ctx = canvas.getContext('2d');

                    // Imagen de fondo
                    const background = await loadImage(imagePath);
                    ctx.drawImage(background, 0, 0, canvas.width, canvas.height);

                    // Texto en el lienzo con mejores validaciones
                    ctx.font = 'bold 40px Arial';
                    ctx.fillStyle = '#000';
                    ctx.textAlign = 'left';
                    ctx.fillText('IDENTIFICACIÓN', 30, 80);

                    ctx.font = '28px Arial';
                    ctx.fillStyle = '#000';
                    ctx.fillText('JUGADOR:', 20, 130);
                    
                    // Truncar username si es muy largo
                    const displayUsername = username.length > 15 ? 
                        username.substring(0, 15) + '...' : username;
                    ctx.fillText(displayUsername.toUpperCase(), 170, 130);

                    ctx.font = 'bold 25px Arial';
                    ctx.fillText(`#${numberConsecutivo}`, 90, 160);

                    ctx.font = '20px Arial';
                    ctx.fillText('ORIGEN: DESCONOCIDO', 30, 220);
                    ctx.fillText('DESTINO: COMPLEX COMMUNITY', 30, 260);

                    const date = new Date();
                    const formattedDate = `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear()}`;
                    ctx.fillText(`LLEGADA: ${formattedDate}`, 30, 300);

                    // Cargar imagen de perfil con manejo de errores
                    try {
                        const profileImage = await loadImage(avatar);
                        
                        // Hacer la imagen circular (opcional)
                        ctx.save();
                        ctx.beginPath();
                        ctx.arc(625, 175, 125, 0, Math.PI * 2, true);
                        ctx.closePath();
                        ctx.clip();
                        ctx.drawImage(profileImage, 500, 50, 250, 250);
                        ctx.restore();
                    } catch (avatarError) {
                        console.log('Error al cargar avatar:', avatarError);
                        // Crear un placeholder si no se puede cargar el avatar
                        ctx.fillStyle = '#cccccc';
                        ctx.fillRect(500, 50, 250, 250);
                        ctx.fillStyle = '#000';
                        ctx.font = '20px Arial';
                        ctx.textAlign = 'center';
                        ctx.fillText('Sin Avatar', 625, 175);
                        ctx.textAlign = 'left';
                    }

                    ctx.font = '15px Arial';
                    ctx.fillStyle = '#000';
                    ctx.fillText('COMPLEX COMMUNITY', 30, 380);
                    ctx.fillText('GTAV', 350, 380);
                    ctx.fillText('WHITELIST APROBADA', 500, 380);

                    attachment = new AttachmentBuilder(canvas.toBuffer('image/png'), { name: 'tarjeta.png' });

                } catch (canvasError) {
                    console.log('Error al crear el canvas:', canvasError);
                    return interaction.followUp({ 
                        content: 'Error al generar la tarjeta de identificación.', 
                        ephemeral: true 
                    });
                }

                // Verificar que los elementos necesarios existen antes de continuar
                const role = interaction.guild.roles.cache.get(whitelist.roleId);
                if (!role) {
                    return interaction.followUp({ 
                        content: 'Error: No se encontró el rol configurado para whitelist.', 
                        ephemeral: true 
                    });
                }

                const member = interaction.guild.members.cache.get(id);
                if (!member) {
                    return interaction.followUp({ 
                        content: 'Error: No se pudo obtener el miembro del servidor.', 
                        ephemeral: true 
                    });
                }

                const channel = interaction.guild.channels.cache.get(whitelist.channelResult);
                if (!channel) {
                    return interaction.followUp({ 
                        content: 'Error: No se encontró el canal de resultados configurado.', 
                        ephemeral: true 
                    });
                }

                try {
                    // Crear un nuevo embed basado en el original y cambiar el color
                    const updatedEmbed = EmbedBuilder.from(embed)
                        .setTitle('Whitelist Aprobada , Consecutivo #' + numberConsecutivo)
                        .setColor('#00FF00')
                        .setFooter({ 
                            text: 'Aprobado por: ' + interaction.user.username, 
                            iconURL: interaction.user.displayAvatarURL() 
                        });

                    // Actualizar el mensaje original con el nuevo embed
                    await interaction.message.edit({ 
                        embeds: [updatedEmbed], 
                        components: [] 
                    });

                    // Asignar el rol al usuario
                    await member.roles.add(role);

                    // Enviar mensaje de confirmación con la tarjeta
                    await channel.send({ 
                        content: `<@${id}> ¡Bienvenido a ${interaction.guild.name}, whitelist aprobada!`, 
                        files: [attachment] 
                    });
                    
                    // Enviar mensaje privado al usuario
                    await interaction.followUp({ 
                        content: `✅ Whitelist aprobada para ${dataUser.user.tag}.`, 
                        ephemeral: true 
                    });

                } catch (finalError) {
                    console.log('Error en las acciones finales:', finalError);
                    return interaction.followUp({ 
                        content: 'Error al completar la aprobación de whitelist.', 
                        ephemeral: true 
                    });
                }
            }
        } catch (err) {
            console.log('Error general:', err);
            
            // Intentar responder al usuario si es posible
            try {
                if (!interaction.replied && !interaction.deferred) {
                    await interaction.reply({ 
                        content: 'Ocurrió un error inesperado. Por favor, contacta con un administrador.', 
                        ephemeral: true 
                    });
                } else if (interaction.deferred) {
                    await interaction.followUp({ 
                        content: 'Ocurrió un error inesperado. Por favor, contacta con un administrador.', 
                        ephemeral: true 
                    });
                }
            } catch (responseError) {
                console.log('No se pudo responder al usuario:', responseError);
            }
        }
    }
};