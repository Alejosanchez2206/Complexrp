const {
    SlashCommandBuilder,
    Client,
    ChatInputCommandInteraction,
    EmbedBuilder,
    ChannelType
} = require('discord.js');

const permisosSchema = require('../../Models/addPermisos');
const config = require('../../config.json');
module.exports = {
    data: new SlashCommandBuilder()
        .setName('sanciones')
        .setDescription('Mandar un mensaje con la sancion para una persona, organización o Facción Legal')
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
            .setRequired(false)),

    /** 
    * @param {ChatInputCommandInteraction} interaction
    * @param {Client} client
    * @returns {Promise<void>}
    */
    async execute(interaction, client) {
        // Variables para el manejo de respuestas
        let hasReplied = false;
        let hasDeferred = false;

        try {
            // Verificaciones básicas
            if (!interaction.guild) {
                await interaction.reply({
                    content: 'Este comando solo se puede usar en un servidor.',
                    ephemeral: true
                });
                return;
            }

            if (!interaction.isChatInputCommand()) {
                console.warn('Interacción no es un comando de chat input');
                return;
            }

            // Defer la respuesta INMEDIATAMENTE para evitar timeouts
            await interaction.deferReply({ ephemeral: true });
            hasDeferred = true;

            console.log(`Comando sanciones ejecutado por: ${interaction.user.tag} (${interaction.user.id})`);

            // Verificar permisos del usuario
            const rolesUser = interaction.member.roles.cache.map(role => role.id);
            const validarRol = await permisosSchema.find({
                permiso: 'sanciones',
                guild: interaction.guild.id,
                rol: { $in: rolesUser }
            });

            if (validarRol.length === 0) {
                await interaction.editReply({
                    content: '❌ No tienes permisos para usar este comando.'
                });
                return;
            }

            // Obtener datos de la sanción
            const tipoSancion = interaction.options.getString('tipo');
            const situacion = interaction.options.getString('situacion');
            const motivo = interaction.options.getString('motivo');
            const sancion = interaction.options.getString('sancion');
            const usuario = interaction.options.getMentionable('usuario');
            const organizacionFaccion = interaction.options.getString('ilegales-legales');

            // Validaciones según el tipo de sanción
            if (tipoSancion === 'usuario' && !usuario) {
                await interaction.editReply({
                    content: '❌ Debes mencionar al usuario sancionado para sanciones de usuario.'
                });
                return;
            }

            if ((tipoSancion === 'organizacion' || tipoSancion === 'faccion_legal') && !organizacionFaccion) {
                const tipoTexto = tipoSancion === 'organizacion' ? 'organización' : 'facción legal';
                await interaction.editReply({
                    content: `❌ Debes escribir el nombre de la ${tipoTexto} sancionada.`
                });
                return;
            }

            // Verificar canal de destino
            const canalDestinoId = config.ChannelSanciones;
            const canalDestino = client.channels.cache.get(canalDestinoId);

            if (!canalDestino) {
                console.error(`Canal de sanciones no encontrado: ${canalDestinoId}`);
                await interaction.editReply({
                    content: '❌ Canal de sanciones no encontrado. Contacta con un administrador.'
                });
                return;
            }

            if (!canalDestino.permissionsFor(interaction.guild.members.me).has(['SendMessages', 'ViewChannel'])) {
                console.error('Bot no tiene permisos en canal de sanciones');
                await interaction.editReply({
                    content: '❌ No tengo permisos para enviar mensajes en el canal de sanciones.'
                });
                return;
            }

            // Generar mensaje de sanción según el tipo
            let mensajeSancion = '';
            let nombreSancionado = '';
            let colorEmbed = 0xFF0000;

            switch (tipoSancion) {
                case 'usuario':
                    nombreSancionado = `${usuario.displayName} (${usuario.id})`;
                    colorEmbed = 0xFF4444;
                    mensajeSancion = `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔒 **Reporte de Sanción Aplicada**

👤 **Usuario Sancionado:** ${usuario}

📝 **Descripción del Incidente:**  
\`${situacion}\`

📌 **Motivo de la Sanción:**  
\`${motivo}\`

⚖️ **Sanción Ejecutada:**  
\`${sancion}\`

📣 **Notificación:** ||@everyone||

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
                    break;

                case 'organizacion':
                    nombreSancionado = organizacionFaccion;
                    colorEmbed = 0xFF8800;
                    mensajeSancion = `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🏛️ **Reporte de Sanción a Organización**

🏢 **Organización Sancionada:**  
\`${organizacionFaccion}\`

📝 **Descripción del Incidente:**  
\`${situacion}\`

📌 **Motivo de la Sanción:**  
\`${motivo}\`

⚖️ **Sanción Aplicada:**  
\`${sancion}\`

📣 **Notificación General:** ||@everyone||

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
                    break;

                case 'faccion_legal':
                    nombreSancionado = organizacionFaccion;
                    colorEmbed = 0x0088FF;
                    mensajeSancion = `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

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

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
                    break;

                default:
                    await interaction.editReply({
                        content: '❌ Tipo de sanción no válido.'
                    });
                    return;
            }

            // Enviar el mensaje de sanción
            console.log('Enviando mensaje de sanción...');
            const mensajeEnviado = await canalDestino.send({ content: mensajeSancion });
            console.log(`Mensaje de sanción enviado: ${mensajeEnviado.id}`);

            // Crear embed para el log
            const tipoTextoLog = {
                'usuario': '👤 Usuario',
                'organizacion': '🏢 Organización',
                'faccion_legal': '⚖️ Facción Legal'
            };

            const logEmbed = new EmbedBuilder()
                .setTitle('⚖️ Nueva Sanción Aplicada')
                .setColor(colorEmbed)
                .addFields(
                    {
                        name: '👨‍⚖️ Staff Responsable',
                        value: `${interaction.user.tag} (${interaction.user.id})`,
                        inline: false
                    },
                    {
                        name: '📂 Tipo de Sanción',
                        value: tipoTextoLog[tipoSancion],
                        inline: true
                    },
                    {
                        name: '🎯 Objetivo Sancionado',
                        value: nombreSancionado.length > 256 ? `${nombreSancionado.slice(0, 253)}...` : nombreSancionado,
                        inline: true
                    },
                    {
                        name: '📝 Situación',
                        value: situacion.length > 1024 ? `${situacion.slice(0, 1021)}...` : situacion,
                        inline: false
                    },
                    {
                        name: '📌 Motivo',
                        value: motivo.length > 1024 ? `${motivo.slice(0, 1021)}...` : motivo,
                        inline: false
                    },
                    {
                        name: '⚖️ Sanción Aplicada',
                        value: sancion.length > 1024 ? `${sancion.slice(0, 1021)}...` : sancion,
                        inline: false
                    },
                    {
                        name: '📡 Canal de Envío',
                        value: `${canalDestino} (${canalDestino.name})`,
                        inline: true
                    },
                    {
                        name: '🆔 ID del Mensaje',
                        value: mensajeEnviado.id,
                        inline: true
                    },
                    {
                        name: '🕒 Fecha y Hora',
                        value: `<t:${Math.floor(Date.now() / 1000)}:F>`,
                        inline: false
                    }
                )
                .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true, size: 256 }))
                .setTimestamp()
                .setFooter({
                    text: `ID de Staff: ${interaction.user.id}`,
                    iconURL: interaction.guild.iconURL({ dynamic: true }) || null
                });

            // Enviar log
            const logChannelId = config.ChannelLogs;
            const logChannel = interaction.guild.channels.cache.get(logChannelId);

            if (logChannel && logChannel.permissionsFor(interaction.guild.members.me).has(['SendMessages', 'ViewChannel'])) {
                try {
                    await logChannel.send({ embeds: [logEmbed] });
                    console.log('Log de sanción enviado exitosamente');
                } catch (logError) {
                    console.error('Error enviando log de sanción:', logError.message);
                }
            } else {
                console.warn('Canal de logs no encontrado o sin permisos para sanciones');
            }

            // Respuesta de confirmación
            await interaction.editReply({
                content: `✅ **Sanción enviada exitosamente**\n\n🎯 **Destino:** ${canalDestino}\n📝 **Tipo:** ${tipoTextoLog[tipoSancion]}\n🆔 **ID del mensaje:** \`${mensajeEnviado.id}\``
            });

            console.log(`Comando sanciones completado exitosamente por ${interaction.user.tag}`);

        } catch (error) {
            console.error(`Error en el comando sanciones:`, error);
            console.error(`Stack trace:`, error.stack);

            // Mensaje de error más específico
            let errorMessage = '❌ Ocurrió un error al ejecutar el comando de sanciones.';

            if (error.code === 50013) {
                errorMessage = '❌ No tengo permisos suficientes para realizar esta acción.';
            } else if (error.code === 50001) {
                errorMessage = '❌ No tengo acceso al canal especificado.';
            } else if (error.code === 10003) {
                errorMessage = '❌ Canal no encontrado.';
            } else if (error.code === 10062) {
                errorMessage = '❌ La interacción ha expirado. Intenta ejecutar el comando nuevamente.';
            }

            // Intentar responder solo si no hemos respondido ya
            try {
                if (hasDeferred && !hasReplied) {
                    await interaction.editReply({ content: errorMessage });
                } else if (!hasDeferred && !hasReplied) {
                    await interaction.reply({ content: errorMessage, ephemeral: true });
                }
            } catch (responseError) {
                console.error('Error al responder con mensaje de error:', responseError.message);
            }
        }
    }
};