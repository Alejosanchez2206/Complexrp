const {
    SlashCommandBuilder,
    Client,
    ChatInputCommandInteraction
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
                .setColor('#FFD700') // Color dorado para hacerlo más amigable
                .setDescription(
                    'Hola, **equipo maravilloso**. 😄\n\nSolo queremos recordarles que hay **personas esperando en la sala de espera** 🕒 y están deseando ser atendidas. ¡Nos encantaría que puedan atenderlos en cuanto puedan!\n\n📋 No olviden **llenar el registro del chat de voz** para que todo esté en orden. ¡Gracias por su dedicación y compromiso!'
                )
                .setFooter({ text: 'Tu presencia hace la diferencia ❤️'});

            await interaction.reply({ content: 'Mensaje enviado', ephemeral: true });
            return interaction.channel.send({ content: `@everyone`, embeds: [embed] });
        } catch (error) {
            console.log(error)
            interation.reply({ content: `Ocurrio un error al ejecutar el comando ${interaction.commandName}`, ephemeral: true });
        }
    }
}