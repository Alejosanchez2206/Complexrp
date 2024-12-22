const {
    SlashCommandBuilder,
    Client,
    ChatInputCommandInteraction,
    EmbedBuilder
} = require('discord.js');


module.exports = {
    data: new SlashCommandBuilder()
        .setName('ip')
        .setDescription('ip del servidor'),

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
            
            const embed = new EmbedBuilder()
                .setColor('#FFD700') // Mantener el color dorado para un toque amigable
                .setTitle('🌐 ¡Conéctate a Complex Community! 🌐') // Título atractivo
                .setDescription(
                    '¡Estamos esperando por ti en **Complex Community**!\n\n' +
                    'Aquí encontrarás aventuras increíbles, un gran equipo y todo lo que necesitas para disfrutar del mejor rol. 🚔🚑\n\n' +
                    '🔗 **Conéctate ahora mismo usando la IP a continuación:**'
                )
                .addFields(
                    { name: '💻 IP del servidor', value: `\`\`\`cmd\nconnect cfx.re/join/p7y6qa\n\`\`\`` }, // IP resaltada
                    { name: '🚀 ¡Nos vemos dentro!', value: 'Prepárate para disfrutar de una experiencia increíble.' }
                )
                .setFooter({ text: 'Gracias por ser parte de nuestra comunidad ❤️'});
            await interaction.reply({ content: 'ip enviado', ephemeral: true });
            return interaction.channel.send({ embeds: [embed] });
        } catch (error) {
            console.log(error);
        }
    }
}