const {
    SlashCommandBuilder,
    Client,
    ChatInputCommandInteraction,
    EmbedBuilder,
    PermissionFlagsBits
} = require('discord.js');

const permisosSchema = require('../../Models/addPermisos');
const stikeShema = require('../../Models/strike');


module.exports = {
    data: new SlashCommandBuilder()
        .setName('verificar-strike')
        .setDescription('Verificar un strike')
        .addUserOption(option =>
            option.setName('usuario')
                .setDescription('Usuario al que se le verificara el strike')
                .setRequired(true)
        ),
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

            const validarRol = await permisosSchema.find({ permiso: 'sanciones', guild: interaction.guild.id, rol: { $in: rolesArray } });


            if (validarRol.length === 0) {
                return interaction.reply({ content: 'No tienes permisos para usar este comando', ephemeral: true });
            }

            const user = interaction.options.getUser('usuario');

            const validarStrike = await stikeShema.find({ guildId: interaction.guild.id, userId: user.id });

            if (validarStrike.length === 0) {
                return interaction.reply({ content: 'El usuario no tiene strikes', ephemeral: true });
            }


            const embed = new EmbedBuilder()
                .setTitle('Verificar Strike')
                .setDescription(`El usuario ${user} tiene ${validarStrike.length} strikes`)
                .setColor('#00FF00') // Color verde para indicar que el usuario tiene strikes
                .setTimestamp()
                .setFooter({
                    text: `Complex community`,
                    iconURL: interaction.guild.iconURL() // Icono del servidor
                });

            for (let i = 0; i < validarStrike.length; i++) {
                const fechaFormateada = new Date(validarStrike[i].date).toLocaleDateString('es-ES'); // Día/Mes/Año
                embed.addFields({
                    name: `🔴 Strike ${i + 1}`,
                    value: `<@&${validarStrike[i].roleId}>`,
                    inline: false
                });
                embed.addFields({
                    name: `📅 Fecha`,
                    value: `${fechaFormateada}`,
                    inline: false
                });
                embed.addFields({
                    name: `👮 Moderador`,
                    value: `<@${validarStrike[i].staff}>`,
                    inline: false
                });
            }



            interaction.reply({ embeds: [embed], ephemeral: true });

        } catch (error) {
            interaction.reply({ content: 'Error al verificar el strike', ephemeral: true });
            console.error('Error al verificar el strike:', error);
        }
    }

}