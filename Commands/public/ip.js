const {
    SlashCommandBuilder,
    ChatInputCommandInteraction,
    EmbedBuilder
} = require('discord.js');

const config = require('../../config.json');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ip')
        .setDescription('Muestra la información de conexión a Brutal Arena.'),

    /** * @param {ChatInputCommandInteraction} interaction
     * @returns {Promise<void>}
     */
    async execute(interaction) {
        try {
            if (!interaction.guild) return;
            if (!interaction.isChatInputCommand()) return;

            const embed = new EmbedBuilder()
                .setColor('#8B0000') // Rojo oscuro, ideal para PvP
                .setTitle('⚔️ Cómo unirte a Brutal Arena ⚔️')
                .setDescription(
                    '¿Listo para el combate? Aquí tienes los pasos exactos para conectarte al servidor y entrar directamente a la arena.'
                )
                .addFields(
                    {
                        name: '🔍 Opción 1: Búsqueda directa',
                        value: 'Dirígete al buscador de servidores y escribe:\n`Brutal Arena`\nSelecciona el servidor en la lista y haz clic en "Conectar".'
                    },
                    {
                        name: '💻 Opción 2: Conexión por consola',
                        value: `1️⃣ Abre el juego.\n2️⃣ Presiona la tecla \`F8\` para abrir la consola.\n3️⃣ Copia y pega el siguiente comando:\n\`\`\`cmd\nconnect https://mia-us-30283-connect.playflare.org\n\`\`\`\n4️⃣ Presiona \`Enter\` y prepárate para pelear.`
                    },
                    {
                        name: '📌 Recomendación',
                        value: 'No olvides marcar el servidor como **Favorito** ⭐ para entrar más rápido en tus próximas batallas.'
                    }
                )
                .setFooter({ text: 'Brutal Arena © — Domina la arena' });

            await interaction.reply({ content: '📩 Instrucciones enviadas al canal.', ephemeral: true });
            return interaction.channel.send({ embeds: [embed] });
            
        } catch (error) {
            console.error('Error ejecutando el comando /ip:', error);
        }
    }
}