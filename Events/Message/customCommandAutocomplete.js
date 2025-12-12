// events/customCommandAutocomplete.js
const { Events } = require('discord.js');
const customCommand = require('../../Models/customCommand');

module.exports = {
    name: Events.InteractionCreate,
    once: false,

    /**
     * @param {import('discord.js').Interaction} interaction
     * @param {import('discord.js').Client} client
     */
    async execute(interaction, client) {
        // Solo procesar autocomplete
        if (!interaction.isAutocomplete()) return;

        // Solo para el comando custom-command
        if (interaction.commandName !== 'custom-command') return;

        try {
            const focusedValue = interaction.options.getFocused().toLowerCase();

            // Buscar comandos que coincidan
            const commands = await customCommand.find({
                guildId: interaction.guild.id
            }).select('commandName tipo').lean();

            // Filtrar y formatear resultados
            const filtered = commands
                .filter(cmd => cmd.commandName.toLowerCase().includes(focusedValue))
                .slice(0, 25) // Discord limita a 25 opciones
                .map(cmd => ({
                    name: `${cmd.commandName} (${cmd.tipo === 'texto' ? '📝 Texto' : '📋 Embed'})`,
                    value: cmd.commandName
                }));

            // Si no hay resultados, mostrar mensaje
            if (filtered.length === 0) {
                filtered.push({
                    name: 'No se encontraron comandos',
                    value: 'no_commands'
                });
            }

            await interaction.respond(filtered);

        } catch (error) {
            console.error('Error en autocomplete de custom-command:', error);
            
            // Responder con array vacío en caso de error
            try {
                await interaction.respond([]);
            } catch (respondError) {
                console.error('Error al responder autocomplete:', respondError);
            }
        }
    }
};