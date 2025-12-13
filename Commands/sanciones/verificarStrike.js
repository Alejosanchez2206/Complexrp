const {
    SlashCommandBuilder,
    Client,
    ChatInputCommandInteraction,
    EmbedBuilder,
    PermissionFlagsBits
} = require('discord.js');

const validarPermiso = require('../../utils/ValidarPermisos');
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

            // ===== VALIDAR PERMISOS =====
            const tienePermiso = await validarPermiso(interaction, 'aplicar_sancion');

            if (!tienePermiso) {
                return interaction.reply({
                    content: '❌ No tienes permisos para usar este comando\n> Necesitas el permiso: `aplicar_sancion`',
                    ephemeral: true
                });
            }
            const user = interaction.options.getUser('usuario');

            const validarStrike = await stikeShema.find({ guildId: interaction.guild.id, userId: user.id });

            if (validarStrike.length === 0) {
                return interaction.reply({ content: 'El usuario no tiene strikes', ephemeral: true });
            }


            const embed = new EmbedBuilder()
                .setTitle('📋 Historial de Strikes')
                .setDescription(`El usuario ${user} tiene **${validarStrike.length}** strike(s) registrados.`)
                .setColor(validarStrike.length > 0 ? '#FFA500' : '#00FF00') // Naranja si hay strikes, verde si no
                .setTimestamp()
                .setFooter({
                    text: 'Complex Community • Sistema de Moderación',
                    iconURL: interaction.guild.iconURL({ dynamic: true }) || undefined
                });

            // Recorrer y agregar detalles de cada strike
            validarStrike.forEach((strike, index) => {
                const fechaFormateada = new Date(strike.date).toLocaleDateString('es-ES', {
                    year: 'numeric', month: 'long', day: 'numeric'
                });

                embed.addFields({
                    name: `⚠️ Strike ${index + 1}`,
                    value: [
                        `🔹 **Rol aplicado:** <@&${strike.roleId}>`,
                        `📅 **Fecha:** ${fechaFormateada}`,
                        `🛡️ **Moderador:** <@${strike.staff}>`
                    ].join('\n'),
                    inline: false
                });
            });




            interaction.reply({ embeds: [embed], ephemeral: true });

        } catch (error) {
            interaction.reply({ content: 'Error al verificar el strike', ephemeral: true });
            console.error('Error al verificar el strike:', error);
        }
    }

}