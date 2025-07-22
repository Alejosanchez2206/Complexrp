const {
    SlashCommandBuilder,
    Client,
    ChatInputCommandInteraction,
    EmbedBuilder,
    PermissionFlagsBits
} = require('discord.js');

const permisosSchema = require('../../Models/addPermisos');
const stikeShema = require('../../Models/strike');
const config = require('../../config.json');
module.exports = {
    data: new SlashCommandBuilder()
        .setName('add-strike')
        .setDescription('Añadir un strike a un usuario')
        .addUserOption(option =>
            option.setName('usuario')
                .setDescription('Usuario al que se le añadira el strike')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('rolstrike')
                .setDescription('Rol de strike')
                .setRequired(true)
                .addChoices(
                    { name: 'Strike-verbal', value: '1354949031444615419' },
                    { name: 'Strike-2', value: '1354949135182201015' },
                    { name: 'Strike-3', value: '1354949174482829475' },
                    { name: 'Strike-4', value: '1354949244494282962' },
                    { name: 'Strike-5', value: '1354949301310328952' },
                )
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
            const rolStrike = interaction.options.getString('rolstrike');

            const member = interaction.guild.members.cache.get(user.id);

            if (!member) return interaction.reply({ content: '❌ Usuario no encontrado.', ephemeral: true });
            if (member.roles.cache.has(rolStrike)) return interaction.reply({ content: '❌ El usuario ya tiene este rol.', ephemeral: true });

            await member.roles.add(rolStrike);

            const logsChannel = client.channels.cache.get(config.ChannelLogs);
            if (!logsChannel) return interaction.reply({ content: '❌ Canal de logs no encontrado.', ephemeral: true });

            // Guardar el strike en la base de datos
            const strikeData = new stikeShema({
                userId: user.id,
                guildId: interaction.guild.id,
                roleId: rolStrike,
                staff: interaction.user.id,
                date: new Date()
            });

            await strikeData.save();
            const embed = new EmbedBuilder()
                .setColor('#FF0000') // Rojo para alertar de una sanción
                .setTitle('🚨 Registro de Strike Aplicado')
                .setDescription(
                    'Se ha aplicado un strike conforme a las normativas establecidas en la comunidad.'
                )
                .addFields(
                    { name: '👤 Usuario Sancionado', value: `<@${user.id}>`, inline: false },
                    { name: '🎯 Rol Asignado', value: `<@&${rolStrike}>`, inline: false },
                    { name: '📅 Fecha de Aplicación', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: false },
                    { name: '🛡️ Moderador Responsable', value: `<@${interaction.user.id}>`, inline: false }
                )
                .setTimestamp()
                .setFooter({
                    text: 'Complex Community • Sistema de Moderación',
                    iconURL: interaction.guild.iconURL({ dynamic: true }) || undefined
                });


            // Enviar el embed al canal de logs

            await logsChannel.send({ embeds: [embed] });

            return interaction.reply({ content: 'Strike aplicado correctamente.', ephemeral: true });


        } catch (error) {
            console.error(error);
            return interaction.reply({ content: 'Ocurrió un error al ejecutar el comando.', ephemeral: true });
        }
    }
}