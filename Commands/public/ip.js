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
                .setColor('#FFD700')
                .setTitle('🌐 Cómo unirte a Complex Community 🌐')
                .setDescription(
                    '¿Tienes problemas para encontrar el servidor en la lista de FiveM? ¡No te preocupes! Aquí te explicamos paso a paso cómo conectarte fácilmente.'
                )
                .addFields(
                    {
                        name: '🔍 Opción 1: Buscar por nombre',
                        value: 'Abre FiveM, dirígete al buscador de servidores y escribe:\n`COMPLEX COMMUNITY`\nSelecciona el servidor y haz clic en "Conectar".'
                    },
                    {
                        name: '💻 Opción 2: Conexión directa por consola',
                        value: '1️⃣ Abre FiveM\n2️⃣ Presiona la tecla `F8` para abrir la consola\n3️⃣ Copia y pega el siguiente comando:\n```cmd\nconnect cfx.re/join/lgvkjj\n```\n4️⃣ Presiona `Enter` y listo, estarás entrando al servidor.'
                    },
                    {
                        name: '📌 Recomendación',
                        value: 'Si deseas conectarte más rápido en el futuro, marca el servidor como favorito. ⭐'
                    },
                    {
                        name: '🚀 ¡Nos vemos dentro!',
                        value: 'Prepárate para vivir una experiencia única de rol junto a toda la comunidad.'
                    }
                )
                .setFooter({ text: 'Gracias por ser parte de Complex Community ❤️' });

            await interaction.reply({ content: '📩 Instrucciones enviadas.', ephemeral: true });
            return interaction.channel.send({ embeds: [embed] });
        } catch (error) {
            console.log(error);
        }
    }
}