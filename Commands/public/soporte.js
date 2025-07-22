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
                .setColor('#FFD700') // Puedes ajustar el color si deseas
                .setTitle('📢 Aviso para los Staff Activos')
                .setDescription(
                    'Estimado equipo de Staff,\n\n' +
                    'Se les informa que **hay ciudadanos esperando en la sala de espera** 🕒. Se requiere la presencia de los staff disponible para atender a los usuarios lo antes posible.\n\n' +
                    '**Instrucciones:**\n' +
                    '- Diríjanse a un canal de soporte adecuado , entrar en la parte crear canal.\n' +
                    '- Una vez tomen el caso o asistan, **registren su participación en el chat correspondinete** para mantener el orden y la trazabilidad de los casos antendidos en soporte.\n\n' +
                    'Agradecemos su pronta respuesta. 🤝'
                )
                .setFooter({ text: 'La eficiencia y el orden son pilares de nuestra institución.' })
                .setTimestamp(); // Opcional: añade la fecha y hora del mensaje

            await interaction.reply({ content: '✅ Anuncio emitido al canal.', ephemeral: true });
            return interaction.channel.send({ content: `@everyone`, embeds: [embed] });

        } catch (error) {
            console.log(error)
            interation.reply({ content: `Ocurrio un error al ejecutar el comando ${interaction.commandName}`, ephemeral: true });
        }
    }
}