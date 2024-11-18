const {
    SlashCommandBuilder,
    Client,
    CahatInputCommandInteraction,
    PermissionFlagsBits
} = require('discord.js');
const config = require('../../config.json');
const tabsSchema = require('../../Models/tabsStaffSchema');
module.exports = {
    data: new SlashCommandBuilder()
        .setName('tab-staff')
        .setDescription('Agrega un rol a un usuario')
        .addStringOption(option => option
            .setName('tab')
            .setDescription('El tab al que se le agregara el rol , solo texto')
            .setRequired(true)
        )
        .addRoleOption(option => option
            .setName('rol')
            .setDescription('El rol que se le agregara al tab')
            .setRequired(true)
        ),

    /**
     * @param {ChatInputCommandInteraction} interation
     * @param {Client} client 
     */

    async execute(interation, client) {
        const { options } = interation;
        const tab = options.getString('tab');
        const rol = options.getRole('rol');

        if (config.Owners === interation.user.id) {
            const validarTabStaff = await tabsSchema.findOne({ roleId: rol.id, guildId: interation.guild.id });
            if (validarTabStaff) {
                await tabsSchema.findOneAndUpdate(
                    { roleId: rol.id, guildId: interation.guild.id },
                    { tabStaff: tab }
                );
                return interation.reply({ content: 'Tab actualizado correctamente', ephemeral: true });
            } else {
                const newTab = new tabsSchema({
                    guildId: interation.guild.id,
                    roleId: rol.id,
                    tabStaff: tab
                });
                await newTab.save();
                return interation.reply({ content: 'Tab agregado correctamente', ephemeral: true });
            }
        }else{
            return interation.reply({ content: 'No tienes permisos para usar este comando', ephemeral: true });
        }

    }
}