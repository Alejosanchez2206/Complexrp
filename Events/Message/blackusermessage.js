const blackUser = require('../../Models/blackUser');
const { Message, Client, EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'messageCreate',
    once: false,
    /**
     * @param {Message} message 
     * @param {Client} client 
     */

    async execute(message, client) {
        if (message.author.bot) return;

        const validarBlack = await blackUser.findOne({ userId: message.author.id });
        if (validarBlack) {
            console.log(`Usuario ${message.author.username} está en la blacklist`);
            try {
                await message.delete(); // Eliminar el mensaje
                console.log(`Mensaje de ${message.author.username} eliminado`);

                let channel = client.channels.cache.get('1147294163449167942');
                const embed = new EmbedBuilder()
                    .setTitle('⚠️ Usuario en Blacklist')
                    .setDescription(`El usuario **${message.author.username}** está en la blacklist.\n**Razón:** ${validarBlack.reason}\n\nEl mensaje ha sido eliminado.`)
                    .setColor('#FF0000')
                    .setThumbnail(message.author.displayAvatarURL({ dynamic: true }))
                    .setFooter({ text: 'Moderación del servidor', iconURL: client.user.displayAvatarURL() })
                    .setTimestamp();
                channel.send({ embeds: [embed] });
            } catch (error) {
                console.error(`Error al eliminar el mensaje: ${error}`);
            }
        }
    }
}