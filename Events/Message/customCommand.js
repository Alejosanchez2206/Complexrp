const config = require('../../config.json');
const customCommandSchema = require('../../Models/customCommand');
const { Message, Client } = require('discord.js');

module.exports = {
    name: 'messageCreate',
    once: false,
    /**
     * @param {Message} message 
     * @param {Client} client 
     */

    async execute(message, client) {
        if (message.content.startsWith(config.PREFIX)) {
            const command = message.content.slice(config.PREFIX.length).split(/ +/);
            const response = await customCommandSchema.findOne({ guildId: message.guild.id, commandName: command[0] });
            if (response) {
                let mensaje = response.response.replace(/  +/g, '\n');
                message.channel.send(mensaje);
            } else {
                return;
            }
        }
    }
}