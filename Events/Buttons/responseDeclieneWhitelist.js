const { AttachmentBuilder, EmbedBuilder } = require('discord.js');
const whitelistSchema = require('../../Models/whitelistSystemSchema');
const permisosSchema = require('../../Models/addPermisos');

module.exports = {
    name: 'interactionCreate',
    async execute(interaction) {
        try {
            if (!interaction.isButton()) return;
            
            if (interaction.customId === 'WhitelistSystemDeclineButton') {
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

                const footer = embed.footer.text;
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

                // Obtener configuración de whitelist
                const whitelist = await whitelistSchema.findOne({ guildId: interaction.guild.id });
                if (!whitelist) {
                    return interaction.followUp({ 
                        content: 'No se ha configurado un sistema de whitelist.', 
                        ephemeral: true 
                    });
                }

                // Validar que el canal de resultados existe
                const channel = interaction.guild.channels.cache.get(whitelist.channelResult);
                if (!channel) {
                    return interaction.followUp({ 
                        content: 'Error: No se encontró el canal de resultados configurado.', 
                        ephemeral: true 
                    });
                }

                try {
                    // Crear un nuevo embed basado en el original - Corregido para v14
                    const updatedEmbed = EmbedBuilder.from(embed)
                        .setTitle('Whitelist Rechazada')
                        .setColor('#FF0000')
                        .setFooter({ 
                            text: 'Rechazada por: ' + interaction.user.username, 
                            iconURL: interaction.user.displayAvatarURL() 
                        })
                        .setTimestamp(); // Agregar timestamp para mejor tracking

                    // Actualizar el mensaje original con el nuevo embed
                    await interaction.message.edit({ 
                        embeds: [updatedEmbed], 
                        components: [] 
                    });                  

                    // Enviar mensaje al canal de resultados
                    await channel.send({ 
                        content: `Lo sentimos <@${id}>, tu solicitud de whitelist ha sido rechazada.`,
                        embeds: [] 
                    });

                } catch (actionError) {
                    console.log('Error en las acciones de rechazo:', actionError);
                    return interaction.followUp({ 
                        content: 'Error al procesar el rechazo de whitelist.', 
                        ephemeral: true 
                    });
                }
            }
        } catch (err) {
            console.log('Error general en whitelist decline:', err);
            
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