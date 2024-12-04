const {
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder,
    ActionRowBuilder,
    SlashCommandBuilder,
    Client,
    ChatInputCommandInteraction,
    ComponentType,
    EmbedBuilder
} = require('discord.js');

const permisosSchema = require('../../Models/addPermisos');


module.exports = {
    data: new SlashCommandBuilder()
        .setName('serveron')
        .setDescription('Activar servidor'),

    /** 
     * @param {ChatInputCommandInteraction} interaction
     * @param {Client} client
     * @returns {Promise<void>}
     *      
     */


    async execute(interaction, client) {
        try {
            if (!interaction.guild) return;
            if (!interaction.isChatInputCommand()) return;

            //Verficar que rol tiene el usuario
            const rolesUser = interaction.member.roles.cache.map(role => role.id).join(',');
            const rolesArray = rolesUser.split(',');

            const validarRol = await permisosSchema.find({ permiso: 'serveronly', guild: interaction.guild.id, rol: { $in: rolesArray } });


            if (validarRol.length === 0) {
                return interaction.reply({ content: 'No tienes permisos para usar este comando', ephemeral: true });
            }

            // Crea el embed
            // Crea el embed
            const embed = new EmbedBuilder()
                .setColor('#00FF00') // Color verde para indicar que el servidor está activo
                .setDescription(
                    '🌟 **¡El servidor está activo y listo para recibirte!** 🎮\n\nHola, **queridos usuarios**. El servidor ya está disponible para que disfruten de su experiencia. 🚀 ¡Nos alegra tenerlos con nosotros!\n\n💬 No olviden mantenerse atentos a los anuncios y reglas del servidor para que todos podamos disfrutar al máximo. ¡Gracias por su paciencia y por ser parte de esta increíble comunidad! 💖'
                )
                .setImage('https://res.cloudinary.com/dwjztzqzz/image/upload/v1733258268/afbaxkbztd6aef5j6mmm.gif') // URL de la imagen grande
                .setFooter({ text: '¡Disfruta y diviértete en el servidor! 🎉' });


            // Define el canal al que se enviará el mensaje (reemplaza 'id' por el ID del canal correcto)
            const otroCanal = await interaction.client.channels.fetch('1162895856614264963');

            if (otroCanal) {
                // Elimina el mensaje anterior (si existe)
                const mensajes = await otroCanal.messages.fetch({ limit: 1 });
                if (mensajes.size > 0) {
                    await mensajes.first().delete();
                }

                // Envía el nuevo mensaje al canal
                await otroCanal.send({ content: '@everyone', embeds: [embed] });

                // Cambia el nombre del canal (reemplaza 'nuevo-nombre-del-canal' por el nombre que desees)
                await otroCanal.setName('💚・ᴄᴏᴍᴘʟᴇx ꜱᴛᴀᴛᴜꜱ');


            } else {
                console.error('No se pudo encontrar el canal.');
            }

            interaction.channel.send({ content: '@everyone', embeds: [embed] });

            // Respuesta a la interacción para confirmar que el comando fue ejecutado
            return await interaction.reply({ content: 'El mensaje ha sido enviado y el canal actualizado.', ephemeral: true });

        } catch (error) {
            console.log(error);
        }


    }

}