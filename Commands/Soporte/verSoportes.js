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
        .setName('ver-soportes')
        .setDescription('Ver historial de soportes de voz')
        .addSubcommand(sub =>
            sub
                .setName('usuario')
                .setDescription('Ver soportes de un usuario específico')
                .addUserOption(opt =>
                    opt.setName('usuario')
                        .setDescription('Usuario a consultar')
                        .setRequired(true)
                )
        )
        .addSubcommand(sub =>
            sub
                .setName('staff')
                .setDescription('Ver soportes atendidos por un staff')
                .addUserOption(opt =>
                    opt.setName('staff')
                        .setDescription('Staff a consultar')
                        .setRequired(true)
                )
        )
        .addSubcommand(sub =>
            sub
                .setName('recientes')
                .setDescription('Ver los últimos soportes registrados')
                .addIntegerOption(opt =>
                    opt.setName('cantidad')
                        .setDescription('Cantidad de soportes a mostrar')
                        .setMinValue(1)
                        .setMaxValue(25)
                )
        )
        .addSubcommand(sub =>
            sub
                .setName('numero')
                .setDescription('Buscar un soporte por su número')
                .addIntegerOption(opt =>
                    opt.setName('numero')
                        .setDescription('Número del soporte')
                        .setRequired(true)
                        .setMinValue(1)
                )
        )
        .addSubcommand(sub =>
            sub
                .setName('estadisticas')
                .setDescription('Ver estadísticas generales de soportes')
        ),

    async execute(interaction, client) {
        try {
            // ===== DEFER REPLY INMEDIATAMENTE =====
            await interaction.deferReply({ ephemeral: true });

            // Validar permisos
            const tienePermiso = await validarPermiso(interaction, 'ver_soportes');

            if (!tienePermiso) {
                return interaction.editReply({
                    content: '❌ No tienes permisos para ver soportes\n> Necesitas el permiso: `ver_soportes`'
                });
            }

            const subcommand = interaction.options.getSubcommand();

            switch (subcommand) {
                case 'usuario':
                    await mostrarSoportesUsuario(interaction);
                    break;
                case 'staff':
                    await mostrarSoportesStaff(interaction);
                    break;
                case 'recientes':
                    await mostrarSoportesRecientes(interaction);
                    break;
                case 'numero':
                    await mostrarSoportePorNumero(interaction);
                    break;
                case 'estadisticas':
                    await mostrarEstadisticas(interaction);
                    break;
            }

        } catch (error) {
            console.error('Error en ver-soportes:', error);
            console.error('Stack:', error.stack);

            try {
                const errorMessage = {
                    content: '❌ Ocurrió un error al consultar los soportes. Por favor, intenta nuevamente.'
                };

                if (interaction.deferred) {
                    await interaction.editReply(errorMessage);
                } else if (!interaction.replied) {
                    await interaction.reply({ ...errorMessage, ephemeral: true });
                }
            } catch (e) {
                console.error('Error al enviar mensaje de error:', e);
            }
        }
    }
};

// ==================== FUNCIONES AUXILIARES ====================

async function mostrarSoportesUsuario(interaction) {
    const usuario = interaction.options.getUser('usuario');

    const soportes = await soporteVozSchema
        .find({ guild: interaction.guild.id, usuarioId: usuario.id })
        .sort({ numeroSoporte: -1 })
        .limit(10)
        .lean();

    if (soportes.length === 0) {
        return interaction.editReply({
            content: `📋 ${usuario} no tiene soportes registrados`
        });
    }

    const embed = new EmbedBuilder()
        .setColor('#0099FF')
        .setTitle(`📋 Historial de Soportes - ${usuario.tag}`)
        .setDescription(`Total de soportes encontrados: **${soportes.length}**`)
        .setThumbnail(usuario.displayAvatarURL());

    soportes.forEach(soporte => {
        const estadoCerrado = soporte.cerrado ? '🔒 Cerrado' : '';
        embed.addFields({
            name: `Soporte #${soporte.numeroSoporte} ${estadoCerrado}`,
            value: `**Caso:** ${soporte.caso}\n**Estado:** ${getEstadoEmoji(soporte.solucionado)}\n**Sanción:** ${getSancionTexto(soporte.sancion)}\n**Staff:** <@${soporte.staffId}>\n**Fecha:** <t:${Math.floor(soporte.timestamp / 1000)}:R>`,
            inline: false
        });
    });

    embed.setFooter({ text: `Mostrando últimos ${soportes.length} soportes` });

    await interaction.editReply({ embeds: [embed] });
}

async function mostrarSoportesStaff(interaction) {
    const staff = interaction.options.getUser('staff');

    const soportes = await soporteVozSchema
        .find({ guild: interaction.guild.id, staffId: staff.id })
        .sort({ numeroSoporte: -1 })
        .limit(10)
        .lean();

    if (soportes.length === 0) {
        return interaction.editReply({
            content: `📋 ${staff} no ha atendido soportes`
        });
    }

    const embed = new EmbedBuilder()
        .setColor('#00FF00')
        .setTitle(`📋 Soportes Atendidos - ${staff.tag}`)
        .setDescription(`Total de soportes atendidos: **${soportes.length}**`)
        .setThumbnail(staff.displayAvatarURL());

    soportes.forEach(soporte => {
        const estadoCerrado = soporte.cerrado ? '🔒 Cerrado' : '';
        embed.addFields({
            name: `Soporte #${soporte.numeroSoporte} ${estadoCerrado}`,
            value: `**Usuario:** <@${soporte.usuarioId}>\n**Caso:** ${soporte.caso}\n**Estado:** ${getEstadoEmoji(soporte.solucionado)}\n**Fecha:** <t:${Math.floor(soporte.timestamp / 1000)}:R>`,
            inline: false
        });
    });

    embed.setFooter({ text: `Mostrando últimos ${soportes.length} soportes` });

    await interaction.editReply({ embeds: [embed] });
}

async function mostrarSoportesRecientes(interaction) {
    const cantidad = interaction.options.getInteger('cantidad') || 10;

    const soportes = await soporteVozSchema
        .find({ guild: interaction.guild.id })
        .sort({ numeroSoporte: -1 })
        .limit(cantidad)
        .lean();

    if (soportes.length === 0) {
        return interaction.editReply({
            content: '📋 No hay soportes registrados'
        });
    }

    const embed = new EmbedBuilder()
        .setColor('#9b59b6')
        .setTitle('📋 Soportes Recientes')
        .setDescription(`Mostrando los últimos **${soportes.length}** soportes registrados`);

    soportes.forEach(soporte => {
        const estadoCerrado = soporte.cerrado ? '🔒' : '📂';
        embed.addFields({
            name: `${estadoCerrado} Soporte #${soporte.numeroSoporte}`,
            value: `**Usuario:** <@${soporte.usuarioId}>\n**Staff:** <@${soporte.staffId}>\n**Caso:** ${soporte.caso}\n**Estado:** ${getEstadoEmoji(soporte.solucionado)}\n**Fecha:** <t:${Math.floor(soporte.timestamp / 1000)}:R>`,
            inline: false
        });
    });

    embed.setFooter({ 
        text: `Total de soportes en el servidor: ${soportes.length}`,
        iconURL: interaction.guild.iconURL()
    });

    await interaction.editReply({ embeds: [embed] });
}

async function mostrarSoportePorNumero(interaction) {
    const numero = interaction.options.getInteger('numero');

    const soporte = await soporteVozSchema.findOne({
        guild: interaction.guild.id,
        numeroSoporte: numero
    }).lean();

    if (!soporte) {
        return interaction.editReply({
            content: `❌ No se encontró el soporte #${numero}`
        });
    }

    const embed = new EmbedBuilder()
        .setColor(soporte.cerrado ? '#FF0000' : '#9b59b6')
        .setTitle(`📞 Soporte-Voz #${soporte.numeroSoporte}`)
        .setDescription(soporte.cerrado ? '🔒 **Este soporte está cerrado**' : '📂 **Soporte activo**')
        .addFields(
            { name: 'Soporte:', value: `${soporte.numeroSoporte}`, inline: true },
            { name: 'Hora:', value: `<t:${Math.floor(soporte.timestamp / 1000)}:t>`, inline: true },
            { name: '\u200b', value: '\u200b', inline: true },
            { name: 'Caso:', value: soporte.caso, inline: false },
            { name: 'Persona:', value: `<@${soporte.usuarioId}> (${soporte.usuarioTag})`, inline: false },
            { name: 'Sanción:', value: getSancionTexto(soporte.sancion), inline: true },
            { name: 'Solucionado:', value: getEstadoEmoji(soporte.solucionado), inline: true },
            { name: '\u200b', value: '\u200b', inline: true },
            { name: 'Atendido por:', value: `<@${soporte.staffId}> (${soporte.staffTag})`, inline: false }
        )
        .setTimestamp(soporte.fecha);

    // Añadir notas si existen
    if (soporte.notas && soporte.notas !== 'Ninguna') {
        embed.addFields({ name: '📋 Notas:', value: soporte.notas, inline: false });
    }

    // Añadir información de cierre si está cerrado
    if (soporte.cerrado && soporte.cerradoPor) {
        embed.addFields({
            name: '🔒 Información de Cierre',
            value: `**Cerrado por:** <@${soporte.cerradoPor}>\n**Fecha de cierre:** <t:${Math.floor(new Date(soporte.fechaCierre).getTime() / 1000)}:R>`,
            inline: false
        });
    }

    // Añadir canal donde se registró
    if (soporte.canalNombre) {
        embed.addFields({
            name: '📍 Canal de Registro',
            value: soporte.canalNombre,
            inline: true
        });
    }

    embed.setFooter({ 
        text: `Soporte-Voz por ${soporte.staffTag} • #${soporte.numeroSoporte}`,
        iconURL: interaction.guild.iconURL()
    });

    await interaction.editReply({ embeds: [embed] });
}

async function mostrarEstadisticas(interaction) {
    const soportes = await soporteVozSchema.find({ guild: interaction.guild.id }).lean();

    if (soportes.length === 0) {
        return interaction.editReply({
            content: '📊 No hay soportes registrados para generar estadísticas'
        });
    }

    const totalSoportes = soportes.length;
    const solucionados = soportes.filter(s => s.solucionado === 'si').length;
    const noSolucionados = soportes.filter(s => s.solucionado === 'no').length;
    const parciales = soportes.filter(s => s.solucionado === 'parcial').length || 0;
    const cerrados = soportes.filter(s => s.cerrado).length || 0;
    const abiertos = totalSoportes - cerrados;

    const conSancion = soportes.filter(s => s.sancion !== 'no').length;
    const sinSancion = soportes.filter(s => s.sancion === 'no').length;

    // Top 5 staff más activos
    const staffCount = {};
    soportes.forEach(s => {
        staffCount[s.staffId] = (staffCount[s.staffId] || 0) + 1;
    });
    
    const topStaff = Object.entries(staffCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([id, count], index) => {
            const medal = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'][index];
            return `${medal} <@${id}>: **${count}** soportes`;
        })
        .join('\n') || 'N/A';

    // Estadísticas por sanción
    const sancionesStats = {};
    soportes.forEach(s => {
        sancionesStats[s.sancion] = (sancionesStats[s.sancion] || 0) + 1;
    });

    const desgloseSanciones = Object.entries(sancionesStats)
        .map(([tipo, count]) => `${getSancionTexto(tipo)}: **${count}**`)
        .join('\n');

    // Tasa de resolución
    const tasaResolucion = ((solucionados / totalSoportes) * 100).toFixed(1);

    const embed = new EmbedBuilder()
        .setColor('#FFD700')
        .setTitle('📊 Estadísticas de Soportes de Voz')
        .setDescription(`Análisis completo del sistema de soportes`)
        .addFields(
            { name: '📈 Total de Soportes', value: `${totalSoportes}`, inline: true },
            { name: '📂 Abiertos', value: `${abiertos}`, inline: true },
            { name: '🔒 Cerrados', value: `${cerrados}`, inline: true },
            { name: '\u200b', value: '\u200b', inline: false },
            { name: '✅ Solucionados', value: `${solucionados}`, inline: true },
            { name: '❌ No Solucionados', value: `${noSolucionados}`, inline: true },
            { name: '🟡 Parciales', value: `${parciales}`, inline: true },
            { name: '\u200b', value: '\u200b', inline: false },
            { name: '⚠️ Con Sanción', value: `${conSancion}`, inline: true },
            { name: '✅ Sin Sanción', value: `${sinSancion}`, inline: true },
            { name: '📊 Tasa de Resolución', value: `${tasaResolucion}%`, inline: true },
            { name: '\u200b', value: '\u200b', inline: false },
            { name: '🏆 Top Staff Más Activos', value: topStaff, inline: false },
            { name: '⚖️ Desglose de Sanciones', value: desgloseSanciones, inline: false }
        )
        .setTimestamp()
        .setFooter({ 
            text: `${interaction.guild.name} • Sistema de Soportes`,
            iconURL: interaction.guild.iconURL() 
        });

    await interaction.editReply({ embeds: [embed] });
}

function getEstadoEmoji(estado) {
    const estados = {
        'si': '✅ Solucionado',
        'no': '❌ No Solucionado',
        'parcial': '🟡 Parcialmente'
    };
    return estados[estado] || estado;
}

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