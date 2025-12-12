const {
    SlashCommandBuilder,
    EmbedBuilder,
    PermissionFlagsBits
} = require('discord.js');

const permisosSchema = require('../../Models/addPermisos');
const soporteVozSchema = require('../../Models/soporteVoz');
const validarPermiso  = require('../../utils/ValidarPermisos');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('registrar-soporte-voz')
        .setDescription('Registra un soporte de voz atendido')
        .addUserOption(option =>
            option.setName('usuario')
                .setDescription('Usuario que solicitó el soporte')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('caso')
                .setDescription('Descripción breve del caso')
                .setRequired(true)
                .setMaxLength(500)
        )
        .addStringOption(option =>
            option.setName('solucionado')
                .setDescription('¿Se solucionó el caso?')
                .setRequired(true)
                .addChoices(
                    { name: 'Sí', value: 'si' },
                    { name: 'No', value: 'no' }
                )
        )
        .addStringOption(option =>
            option.setName('sancion')
                .setDescription('¿Hubo alguna sanción?')
                .setRequired(false)
                .addChoices(
                    { name: 'No', value: 'no' },
                    { name: 'Advertencia', value: 'advertencia' },
                    { name: 'Kick', value: 'kick' },
                    { name: 'Ban Temporal', value: 'ban_temporal' },
                    { name: 'Ban Permanente', value: 'ban_permanente' }
                )
        )
        .addStringOption(option =>
            option.setName('notas')
                .setDescription('Notas adicionales o detalles importantes')
                .setRequired(false)
                .setMaxLength(1000)
        ),

    async execute(interaction, client) {
        try {
            // ===== VALIDAR PERMISOS =====
            const tienePermiso = await validarPermiso(interaction, 'registrar_soporte');
            
            if (!tienePermiso) {
                return interaction.reply({
                    content: '❌ No tienes permisos para registrar soportes de voz\n> Necesitas el permiso: `registrar_soporte`',
                    ephemeral: true
                });
            }

            // ===== OBTENER DATOS =====
            const usuario = interaction.options.getUser('usuario');
            const caso = interaction.options.getString('caso');
            const solucionado = interaction.options.getString('solucionado');
            const sancion = interaction.options.getString('sancion') || 'no';
            const notas = interaction.options.getString('notas') || 'Ninguna';

            // ===== OBTENER NÚMERO DE SOPORTE =====
            const numeroSoporte = await obtenerNumeroSoporte(interaction.guild.id);

            // ===== CREAR REGISTRO EN BD =====
            const nuevoSoporte = new soporteVozSchema({
                guild: interaction.guild.id,
                numeroSoporte: numeroSoporte,
                usuarioId: usuario.id,
                usuarioTag: usuario.tag,
                staffId: interaction.user.id,
                staffTag: interaction.user.tag,
                caso: caso,
                solucionado: solucionado,
                sancion: sancion,
                notas: notas,
                canalId: interaction.channel.id,
                canalNombre: interaction.channel.name,
                fecha: new Date(),
                timestamp: Date.now()
            });

            await nuevoSoporte.save();

            // ===== CREAR EMBED PARA EL CANAL ACTUAL =====
            const embedPublico = new EmbedBuilder()
                .setColor('#9b59b6')
                .setAuthor({
                    name: 'ComplexRP',
                    iconURL: interaction.guild.iconURL()
                })
                .setTitle('📞 • Soporte-Voz')
                .setDescription(`**Soporte-Voz #${numeroSoporte}**`)
                .addFields(
                    { name: 'Soporte:', value: `${numeroSoporte}`, inline: true },
                    { name: 'Hora:', value: `<t:${Math.floor(Date.now() / 1000)}:t>`, inline: true },
                    { name: '\u200b', value: '\u200b', inline: true },
                    { name: 'Caso:', value: caso, inline: false },
                    { name: 'Persona:', value: `${usuario}`, inline: false },
                    { name: 'Sanción:', value: sancion, inline: true },
                    { name: 'Solucionado:', value: solucionado, inline: true },
                    { name: 'Atendido:', value: `@ ${interaction.member}`, inline: false }
                )
                .setFooter({ text: `Soporte-Voz por ${interaction.user.tag} • #${numeroSoporte}` })
                .setTimestamp();

            // Si hay notas diferentes a "Ninguna", añadirlas
            if (notas && notas !== 'Ninguna') {
                embedPublico.addFields({ name: '📋 Notas:', value: notas, inline: false });
            }

            // ===== ENVIAR EN EL CANAL ACTUAL =====
            await interaction.channel.send({ embeds: [embedPublico] });

            // ===== RESPONDER AL STAFF (SOLO VISIBLE PARA ÉL) =====
            const embedConfirm = new EmbedBuilder()
                .setColor('#00FF00')
                .setTitle('✅ Soporte Registrado Exitosamente')
                .setDescription(`El soporte de voz #${numeroSoporte} ha sido registrado correctamente`)
                .addFields(
                    { name: '📊 Número de Soporte', value: `#${numeroSoporte}`, inline: true },
                    { name: '👤 Usuario', value: `${usuario.tag}`, inline: true },
                    { name: '📍 Canal', value: `${interaction.channel}`, inline: true }
                )
                .setTimestamp()
                .setFooter({ 
                    text: 'El registro se ha publicado en el canal',
                    iconURL: interaction.user.displayAvatarURL()
                });

            await interaction.reply({ 
                embeds: [embedConfirm], 
                ephemeral: true 
            });

            // ===== LOG EN CONSOLA =====
            console.log(`[SOPORTE VOZ] #${numeroSoporte} | ${usuario.tag} | Staff: ${interaction.user.tag} | Canal: ${interaction.channel.name} | ${interaction.guild.name}`);

        } catch (error) {
            console.error('Error en registrar-soporte-voz:', error);
            console.error('Stack:', error.stack);
            
            const errorEmbed = new EmbedBuilder()
                .setColor('#FF0000')
                .setTitle('❌ Error al Registrar Soporte')
                .setDescription('Ocurrió un error al procesar el registro. Por favor, intenta nuevamente.')
                .addFields(
                    { name: 'Error', value: error.message || 'Error desconocido', inline: false }
                )
                .setTimestamp();

            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({
                    embeds: [errorEmbed],
                    ephemeral: true
                });
            } else {
                await interaction.followUp({
                    embeds: [errorEmbed],
                    ephemeral: true
                });
            }
        }
    }
};

// ==================== FUNCIONES AUXILIARES ====================


/**
 * Obtiene el siguiente número de soporte
 */
async function obtenerNumeroSoporte(guildId) {
    try {
        const ultimoSoporte = await soporteVozSchema
            .findOne({ guild: guildId })
            .sort({ numeroSoporte: -1 })
            .lean();

        const nuevoNumero = ultimoSoporte ? ultimoSoporte.numeroSoporte + 1 : 1;
        console.log(`[SOPORTE VOZ] Nuevo número de soporte: ${nuevoNumero}`);
        return nuevoNumero;
        
    } catch (error) {
        console.error('Error al obtener número de soporte:', error);
        return 1;
    }
}

/**
 * Obtiene emoji según el estado
 */
function getEstadoEmoji(estado) {
    const estados = {
        'si': '✅ Solucionado',
        'no': '❌ No Solucionado',
        'parcial': '🟡 Parcialmente Solucionado'
    };
    return estados[estado] || estado;
}

/**
 * Obtiene texto de la sanción
 */
function getSancionTexto(sancion) {
    const sanciones = {
        'no': '✅ Sin sanción',
        'advertencia': '⚠️ Advertencia',
        'kick': '👢 Kick',
        'ban_temporal': '🔨 Ban Temporal',
        'ban_permanente': '🚫 Ban Permanente'
    };
    return sanciones[sancion] || sancion;
}