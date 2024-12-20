const {
    SlashCommandBuilder,
    Client,
    PermissionFlagsBits
} = require('discord.js');
const config = require('../../config.json');
const customCommand = require('../../Models/customCommand');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('custom-command')
        .setDescription('Crea un comando personalizado')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addStringOption(option => option
            .setName('nombre')
            .setDescription('El nombre del comando')
            .setRequired(true)
        )
        .addStringOption(option => option
            .setName('respuesta')
            .setDescription('La respuesta del comando')
            .setRequired(true)
        ),

    /**
     * @param {ChatInputCommandInteraction} interation
     * @param {Client} client 
     */

    async execute(interation, client) {
        const { options } = interation;
        const commandName = options.getString('nombre');
        const response = options.getString('respuesta');
        if (config.Owners === interation.user.id) {
            const validarComando = await customCommand.findOne({ guildId: interation.guild.id, commandName: commandName });
            if (validarComando) {
                await customCommand.findOneAndUpdate(
                    { guildId: interation.guild.id, commandName: commandName },
                    { response: response }
                );
                return interation.reply({ content: 'Comando actualizado correctamente', ephemeral: true });
            } else {
                const newCommand = new customCommand({
                    guildId: interation.guild.id,
                    commandName: commandName,
                    response: response
                });
                await newCommand.save();
                return interation.reply({ content: 'Comando agregado correctamente', ephemeral: true });
            }
        } else {
            return interation.reply({ content: 'No tienes permisos para usar este comando', ephemeral: true });
        }
    }
}

