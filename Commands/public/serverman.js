const {
    SlashCommandBuilder,
    Client,
    ChatInputCommandInteraction,
    EmbedBuilder
} = require('discord.js');

const permisosSchema = require('../../Models/addPermisos');
const mensajeText = require('../../mensajes.json')



module.exports = {
    data: new SlashCommandBuilder()
        .setName('serverman')
        .setDescription('Comando de mantenimiento'),

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

            const validarRol = await permisosSchema.find({ permiso: 'serverman', guild: interaction.guild.id, rol: { $in: rolesArray } });


            if (validarRol.length === 0) {
                return interaction.reply({ content: 'No tienes permisos para usar este comando', ephemeral: true });
            }

            // Crea el embed

            // Crea el embed
            const embed = new EmbedBuilder()
                .setColor('#FF0000') // Color rojo para indicar mantenimiento
                .setDescription(
                    mensajeText.SERVERMAN
                )
                .setImage("https://i.imgur.com/7YCNrsu.gif") // URL de la imagen
                .setFooter({ text: mensajeText.FOOTER });


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
                await otroCanal.setName('🔧〡ᴄᴏᴍᴘʟᴇx ꜱᴛᴀᴛᴜꜱ');


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