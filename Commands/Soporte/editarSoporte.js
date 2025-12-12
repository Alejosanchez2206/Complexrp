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
        .setName('editar-soporte')
        .setDescription('Edita un soporte de voz existente')
        .addIntegerOption(option =>
            option.setName('numero')
                .setDescription('Número del soporte a editar')
                .setRequired(true)
                .setMinValue(1)
        )
        .addStringOption(option =>
            option.setName('campo')
                .setDescription('Campo a editar')
                .setRequired(true)
                .addChoices(
                    { name: 'Caso', value: 'caso' },
                    { name: 'Solucionado', value: 'solucionado' },
                    { name: 'Sanción', value: 'sancion' },
                    { name: 'Notas', value: 'notas' }
                )
        )
        .addStringOption(option =>
            option.setName('valor')
                .setDescription('Nuevo valor')
                .setRequired(true)
                .setMaxLength(1000)
        ),

    async execute(interaction, client) {
        try {
            // ===== VALIDAR PERMISOS =====
            const tienePermiso = await validarPermiso(interaction, 'editar_soporte');
            
            if (!tienePermiso) {
                return interaction.reply({
                    content: '❌ No tienes permisos para editar soportes\n> Necesitas el permiso: `editar_soporte`',
                    ephemeral: true
                });
            }

            const numeroSoporte = interaction.options.getInteger('numero');
            const campo = interaction.options.getString('campo');
            const nuevoValor = interaction.options.getString('valor');

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

            // ===== GUARDAR VALOR ANTERIOR =====
            const valorAnterior = soporte[campo];

            // ===== ACTUALIZAR SOPORTE =====
            soporte[campo] = nuevoValor;
            await soporte.save();

            // ===== CREAR EMBED DE CONFIRMACIÓN =====
            const embed = new EmbedBuilder()
                .setColor('#FFA500')
                .setTitle('✏️ Soporte Editado')
                .setDescription(`El soporte #${numeroSoporte} ha sido actualizado`)
                .addFields(
                    { name: '📊 Número', value: `#${numeroSoporte}`, inline: true },
                    { name: '📝 Campo Editado', value: campo, inline: true },
                    { name: '👮 Editado por', value: `${interaction.user}`, inline: true },
                    { name: '❌ Valor Anterior', value: valorAnterior || 'N/A', inline: false },
                    { name: '✅ Nuevo Valor', value: nuevoValor, inline: false }
                )
                .setTimestamp()
                .setFooter({ text: `Staff: ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() });

            await interaction.reply({ embeds: [embed] });

            console.log(`[SOPORTE VOZ] #${numeroSoporte} editado por ${interaction.user.tag} - Campo: ${campo}`);

        } catch (error) {
            console.error('Error en editar-soporte:', error);
            
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({
                    content: '❌ Ocurrió un error al editar el soporte',
                    ephemeral: true
                });
            }
        }
    }
};

