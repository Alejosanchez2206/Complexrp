const { Events } = require('discord.js');
const welcomeSystem = require('../../Functions/welcomeSystemGuild'); // Ruta a la función

module.exports = {
    name: Events.GuildMemberAdd,
    async execute(member, client) {
        try {
            await welcomeSystem.execute(member, client);
        } catch (error) {
            console.error(`Error en el sistema de bienvenida: ${error.message}`);
        }
    }
};
