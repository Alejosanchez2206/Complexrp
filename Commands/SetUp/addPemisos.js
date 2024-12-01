const {
    SlashCommandBuilder,
    Client,
    PermissionFlagsBits,
    ChatInputCommandInteraction,
    ChannelType
} = require('discord.js');

const permisosSchema = require('../../Models/addPermisos');
const permisosEspecialSchema = require('../../Models/permisosEspecial');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('add-permisos')
        .setDescription('Añade permisos')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addRoleOption(option =>
            option.setName('rol')
                .setDescription('Rol para añadir permisos')
                .setRequired(true)
        ).addStringOption(option =>
            option.setName('permiso')
                .setDescription('Permisos para añadir')
                .setRequired(true)
                .addChoices(
                    { name: 'soporte', value: 'soporte' },
                    { name: 'sanciones', value: 'sanciones' },
                    { name: 'subir-foto', value: 'subir-foto' },
                    { name : 'whitelist', value: 'whitelist' },
                    { name : 'annunciar', value: 'annunciar' },
                    { name : 'seend-img', value: 'seend-img' },
                    { name : 'revisar-whitelist', value: 'revisar-whitelist' },
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

            const rol = interaction.options.getRole('rol');
            const permiso = interaction.options.getString('permiso');

            const validarEspecial = await permisosEspecialSchema.findOne({ guildServidor: interaction.guild.id, guildUsuario: interaction.user.id });
            
            if (!validarEspecial) { return interaction.reply({ content: 'No tienes permisos para usar este comando', ephemeral: true }); }

            const data = await permisosSchema.findOne({ guild: interaction.guild.id, rol: rol });
            if (data) {
                await permisosSchema.findOneAndUpdate(
                    { guild: interaction.guild.id, rol: rol.id },
                    { permiso: permiso }
                );
                return interaction.reply({ content: 'Permisos actualizados correctamente', ephemeral: true });
            }

            const newData = new permisosSchema({
                guild: interaction.guild.id,
                rol: rol.id,
                permiso: permiso
            });
            await newData.save();

            return interaction.reply({ content: 'Permisos añadidos correctamente', ephemeral: true });
        } catch (error) {
            console.log(error)
            interation.reply({ content: `Ocurrio un error al ejecutar el comando ${interation.commandName}`, ephemeral: true });
        }
    }
}
