const {
    SlashCommandBuilder,
    Client,
    ChatInputCommandInteraction
} = require('discord.js');

const permisosSchema = require('../../Models/addPermisos');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('sanciones')
        .setDescription('Mandar un mensaje con la sancion para una persona , organizacion o Faccion Legal')
        .addStringOption(option => option
            .setName('tipo')
            .setDescription('Elige a quien va dirigida la sancion')
            .setRequired(true)
            .addChoices(
                { name: 'Usuario', value: 'usuario' },
                { name: 'Organización', value: 'organizacion' },
                { name: 'Facción Legal', value: 'faccion_legal' },
            )
        )
        .addStringOption(option => option
            .setName('situacion')
            .setDescription('Describe la situación de la sancion')
            .setRequired(true)
        )
        .addStringOption(option => option
            .setName('motivo')
            .setDescription('Describe el motivo de la sancion')
            .setRequired(true)
        )
        .addStringOption(option => option
            .setName('sancion')
            .setDescription('Establece la sanción que se le mandara')
            .setRequired(true)
        )
        .addMentionableOption(option =>
            option.setName('usuario')
                .setDescription('Menciona al usuario sancionado (solo para sanciones de usuario)')
                .setRequired(false))
        .addStringOption(option => option
            .setName('ilegales-legales')
            .setDescription('Escribe el nombre de la org o facc legal (solo para sanciones de org o facc legal)')
            .setRequired(false))
    ,

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

            //obtener datos de la sancion
            const tipoSancion = interaction.options.getString('tipo');
            const situacion = interaction.options.getString('situacion');
            const motivo = interaction.options.getString('motivo');
            const sancion = interaction.options.getString('sancion');
            const usuario = interaction.options.getMentionable('usuario');
            const organizacionFaccion = interaction.options.getString('ilegales-legales');

            let mensajeSancion = '';
            switch (tipoSancion) {
                case 'usuario':
                    if (!usuario) {
                        return interaction.reply({ content: 'Debes mencionar al usuario sancionado.', ephemeral: true });
                    }
                    mensajeSancion = `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔒 **Reporte de Sanción Aplicada**

👤 **Usuario Sancionado:** ${usuario}

📝 **Descripción del Incidente:**  
\`${situacion}\`

📌 **Motivo de la Sanción:**  
\`${motivo}\`

⚖️ **Sanción Ejecutada:**  
\`${sancion}\`

📣 **Notificación:** ||@everyone||

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

                    `;
                    break;

                case 'organizacion':
                    if (!organizacionFaccion) {
                        return interaction.reply({ content: 'Debes escribir el nombre de la organización sancionada.', ephemeral: true });
                    }
                    mensajeSancion = `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🏛️ **Reporte de Sanción a Organización/Facción**

🏢 **Organización Sancionada:**  
\`${organizacionFaccion}\`

📝 **Descripción del Incidente:**  
\`${situacion}\`

📌 **Motivo de la Sanción:**  
\`${motivo}\`

⚖️ **Sanción Aplicada:**  
\`${sancion}\`

📣 **Notificación General:** ||@everyone||

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

                    `;
                    break;

                case 'faccion_legal':
                    if (!organizacionFaccion) {
                        return interaction.reply({ content: 'Debes escribir el nombre de la facción legal sancionada.', ephemeral: true });
                    }
                    mensajeSancion = `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📄 **Informe de Sanción - Facción Legal**

⚖️ **Facción Sancionada:**  
\`${organizacionFaccion}\`

📝 **Descripción del Incidente:**  
\`${situacion}\`

📌 **Motivo de la Sanción:**  
\`${motivo}\`

🧹 **Medida Disciplinaria Aplicada:**  
\`${sancion}\`

📣 **Notificación General:** ||@everyone||

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

                    `;
                    break;

                default:
                    return interaction.send({ content: 'Tipo de sanción no válido.', ephemeral: true });
            }

            // También enviar en el canal correspondiente
            const channel = client.channels.cache.get('1306428946681696297');  // Reemplaza con el ID del canal
            // Enviar el mensaje de sanción
            await channel.send({ content: mensajeSancion });
            interaction.reply({ content: 'Sanción enviada con exito', ephemeral: true });
        } catch (error) {
            console.log(error)
            interaction.reply({ content: `Ocurrio un error al ejecutar el comando ${interaction.commandName}`, ephemeral: true });
        }
    }
}