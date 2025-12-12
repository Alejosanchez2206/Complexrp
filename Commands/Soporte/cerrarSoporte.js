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
        .setName('cerrar-soporte')
        .setDescription('Cierra un soporte de voz existente')
        .addIntegerOption(option =>
            option.setName('numero')
                .setDescription('Número del soporte a cerrar')
                .setRequired(true)
                .setMinValue(1)
        )
        .addStringOption(option =>
            option.setName('razon')
                .setDescription('Razón del cierre')
                .setRequired(false)
                .setMaxLength(500)
        ),

    async execute(interaction, client) {
        try {
            // ===== VALIDAR PERMISOS =====
            const tienePermiso = await validarPermiso(interaction, 'cerrar_soporte');
            
            if (!tienePermiso) {
                return interaction.reply({
                    content: '❌ No tienes permisos para cerrar soportes\n> Necesitas el permiso: `cerrar_soporte`',
                    ephemeral: true
                });
            }

            const numeroSoporte = interaction.options.getInteger('numero');
            const razon = interaction.options.getString('razon') || 'Sin especificar';

            // ===== BUSCAR SOPORTE =====
            const soporte = await soporteVozSchema.findOne({
                guild: interaction.guild.id,
                numeroSoporte: numeroSoporte
            });

            if (!soporte) {
                return interaction.reply({
                    content: `❌ No se encontró el soporte #${numeroSoporte}`,
                    ephemeral: true
                });
            }

            if (soporte.cerrado) {
                return interaction.reply({
                    content: `⚠️ El soporte #${numeroSoporte} ya está cerrado`,
                    ephemeral: true
                });
            }

            // ===== CERRAR SOPORTE =====
            soporte.cerrado = true;
            soporte.cerradoPor = interaction.user.id;
            soporte.fechaCierre = new Date();
            await soporte.save();

            // ===== CREAR EMBED DE CONFIRMACIÓN =====
            const embed = new EmbedBuilder()
                .setColor('#FF0000')
                .setTitle('🔒 Soporte Cerrado')
                .setDescription(`El soporte de voz #${numeroSoporte} ha sido cerrado`)
                .addFields(
                    { name: '📊 Número', value: `#${numeroSoporte}`, inline: true },
                    { name: '👤 Usuario', value: `<@${soporte.usuarioId}>`, inline: true },
                    { name: '👮 Cerrado por', value: `${interaction.user}`, inline: true },
                    { name: '📝 Caso Original', value: soporte.caso, inline: false },
                    { name: '🔒 Razón de Cierre', value: razon, inline: false }
                )
                .setTimestamp()
                .setFooter({ text: `Staff: ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() });

            await interaction.reply({ embeds: [embed] });

            console.log(`[SOPORTE VOZ] #${numeroSoporte} cerrado por ${interaction.user.tag}`);

        } catch (error) {
            console.error('Error en cerrar-soporte:', error);
            
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({
                    content: '❌ Ocurrió un error al cerrar el soporte',
                    ephemeral: true
                });
            }
        }
    }
};

