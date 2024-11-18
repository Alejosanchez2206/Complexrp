const { 
    Client,
    ChatInputCommandInteraction,
    Events 
} = require('discord.js');


module.exports = {
    name: Events.InteractionCreate,
    once: false,
    /**
     * @param {ChatInputCommandInteraction} interation
     * @param {Client} client 
     * * 
     * */
    async execute(interation, client) {
        if (!interation.guild || !interation.channel) return;
        if (!interation.isChatInputCommand) return;
        const command = client.commands.get(interation.commandName);
      

        if (command) {
            if (!command) return interation.reply({ content: `No se encontro el comando ${interation.commandName}` });
            try {               
                command.execute(interation, client);
            } catch (error) {
                return interation.reply({ content: `Ocurrio un error al ejecutar el comando ${interation.commandName}` , ephemeral: true });
            }

        }
    }
}
