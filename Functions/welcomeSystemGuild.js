const { GuildMember, Client, EmbedBuilder } = require('discord.js');
const welcomeSchema = require('../Models/welcomeSchema'); // Asegúrate que el esquema esté bien definido

module.exports = {

    /**
     * @param {GuildMember} member
     * @param {Client} client
     */

    async execute(member, client) {       
        // Buscamos los datos en el esquema
        const data = await welcomeSchema.findOne({ guilId: member.guild.id });

        // Verificamos que se encuentren los datos y el channelId
        if (!data || !data.channelId) {
            return;
        }

        // Verificamos que el canal exista
        const channel = member.guild.channels.cache.get(data.channelId);
        if (!channel) {
            console.error(`El canal con ID ${data.channelId} no existe o el bot no tiene acceso.`);
            return;
        }

        // Creamos el embed de bienvenida
        const embed = new EmbedBuilder()
            .setAuthor({ name: `Bienvenid@ <@${member.user.id}>`, iconURL: member.user.displayAvatarURL() })
            .setDescription(data.WelcomeMessage)
            .setColor(data.WelcomeColor || '#62049D')
            .setImage(data.WelcomeImage || member.guild.iconURL())
            .setFooter({ text: 'Disfruta tu estancia', iconURL: client.user ? client.user.displayAvatarURL() : null })
            .setTimestamp();

        // Intentamos enviar el mensaje        
        try {
            await channel.send({ embeds: [embed] });
        } catch (error) {
            console.error(`Error al enviar el mensaje de bienvenida: ${error}`);
        }
    }
};
