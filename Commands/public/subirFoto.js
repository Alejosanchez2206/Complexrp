const {
    SlashCommandBuilder,
    Client,
    ChatInputCommandInteraction,
   
    EmbedBuilder
} = require('discord.js');

const axios = require('axios');
const permisosSchema = require('../../Models/addPermisos');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('subir-foto')
        .setDescription('Subir una foto a la seccion de multimedia')
        .addStringOption(option => option
            .setName('url')
            .setDescription('Url de la imagen (Discord)')
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

            const validarRol = await permisosSchema.find({ permiso: 'subir-foto', guild: interaction.guild.id, rol: { $in: rolesArray } });

            if (validarRol.length === 0) {
                return interaction.reply({ content: 'No tienes permisos para usar este comando', ephemeral: true });
            }

            //Obtener datos de la foto
            const urlImg = interaction.options.getString('url');

            const dataInsert = {
                "url" : urlImg,
                "type" : "img",
                "name" : "Complex"
            }

            const response = await axios.post('http://localhost:5000/api/multimedia', dataInsert);
            const data = response.data;

            if (data.error) {
                return interaction.reply({ content: data.error, ephemeral: true });
            }

            const embed = new EmbedBuilder()
                .setColor('#FFD700') // Color dorado para hacerlo más amigable
                .setDescription(
                    'La imagen se ha subido exitosamente'
                ).setImage(data.url);

            return interaction.reply({ content: 'Imagen subida correctamente', embeds: [embed] , ephemeral: true });
                      

        } catch (error) {
            console.log(error)
            return interaction.reply({ content: 'Ocurrio un error al ejecutar el comando', ephemeral: true });
        }
    }
}