const {
    SlashCommandBuilder,
    Client,
    ChatInputCommandInteraction,
    EmbedBuilder
} = require('discord.js');

const permisosSchema = require('../../Models/addPermisos');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('soporte')
        .setDescription('Enviar un mensaje de que hay personas en sala de espera'),


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

            const validarRol = await permisosSchema.find({ permiso: 'soporte', guild: interaction.guild.id, rol: { $in: rolesArray } });


            if (validarRol.length === 0) {
                return interaction.reply({ content: 'No tienes permisos para usar este comando', ephemeral: true });
            }

            const embed = new EmbedBuilder()
                .setColor('#FFD700')
                .setDescription(
                    'Estimado equipo,\n\nQueremos recordarles amablemente que actualmente hay personas aguardando en la **sala de espera** 🕒. Su tiempo y atención son muy valorados, por lo que agradecemos que puedan brindarles asistencia a la brevedad posible.\n\n📋 Asimismo, les pedimos por favor **registrar su participación en el chat de voz** correspondiente para mantener todo debidamente organizado.\n\nAgradecemos sinceramente su compromiso y dedicación diaria. 🤝'
                )
                .setFooter({ text: 'Su presencia marca la diferencia. ❤️' });

            await interaction.reply({ content: '📩 Mensaje enviado con éxito.', ephemeral: true });
            return interaction.channel.send({ content: `@everyone`, embeds: [embed] });

        } catch (error) {
            console.log(error)
            interation.reply({ content: `Ocurrio un error al ejecutar el comando ${interaction.commandName}`, ephemeral: true });
        }
    }
}