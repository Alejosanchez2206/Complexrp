// events/tempVoiceInteractions.js
const {
    Events,
    EmbedBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ActionRowBuilder,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder,
    ButtonBuilder,
    ButtonStyle
} = require('discord.js');
const tempVoiceSchema = require('../../Models/tempVoiceConfig');

// Importar constantes del comando
const { CATEGORIAS_PERMISOS, TODOS_PERMISOS } = require('../../Commands/owner/tempVoices');

module.exports = {
    name: Events.InteractionCreate,
    once: false,

    async execute(interaction, client) {
        try {
            // SELECT MENUS
            if (interaction.isStringSelectMenu()) {
                const customId = interaction.customId;

                if (customId.startsWith('tv_remover_')) return await handleRemoverPermiso(interaction);
                if (customId.startsWith('tv_multiple_')) return await handleMultipleSelect(interaction);
                if (customId.startsWith('tv_config_')) return await handleConfigMenu(interaction);
                if (customId.startsWith('tv_limit_')) return await handleLimitSelect(interaction);
                if (customId.startsWith('tv_bitrate_')) return await handleBitrateSelect(interaction);
                if (customId.startsWith('tv_privacy_')) return await handlePrivacySelect(interaction);
            }

            // BOTONES
            if (interaction.isButton()) {
                const customId = interaction.customId;

                if (customId.startsWith('tv_page_') && !customId.includes('info')) return await handlePageNavigation(interaction);
                if (customId.startsWith('tv_finalizar_')) return await handleFinalizar(interaction);
                if (customId.startsWith('tv_delete_')) return await handleDeleteChannel(interaction);
                if (customId === 'tv_keep') return await handleKeepChannel(interaction);
            }

            // MODALES
            if (interaction.isModalSubmit()) {
                if (interaction.customId.startsWith('tv_name_modal_')) return await handleNameModal(interaction);
            }

        } catch (error) {
            console.error('[TempVoice] Error:', error);
            const msg = `❌ Error: ${error.message}`;
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({ content: msg, ephemeral: true }).catch(() => {});
            }
        }
    }
};

async function handleRemoverPermiso(interaction) {
    const [, , generadorId, rolId] = interaction.customId.split('_');
    const permisoRemover = interaction.values[0];

    const config = await tempVoiceSchema.findOne({
        guildId: interaction.guild.id,
        generatorChannelId: generadorId
    });

    if (!config) return interaction.update({ content: '❌ No encontrado.', components: [], embeds: [] });

    const roleData = config.rolesPermisos.find(r => r.roleId === rolId);
    if (!roleData) return interaction.update({ content: '❌ Rol no encontrado.', components: [], embeds: [] });

    const idx = roleData.permisos.indexOf(permisoRemover);
    if (idx > -1) {
        roleData.permisos.splice(idx, 1);
        await config.save();
    }

    const info = TODOS_PERMISOS.find(p => p.value === permisoRemover);
    const rol = interaction.guild.roles.cache.get(rolId);

    const embed = new EmbedBuilder()
        .setColor('#00FF00')
        .setTitle('✅ Permiso Removido')
        .addFields(
            { name: '👥 Rol', value: `${rol || rolId}`, inline: true },
            { name: '🔐 Permiso', value: `${info?.emoji || '✓'} ${info?.name || permisoRemover}`, inline: true },
            { name: '📊 Restantes', value: `${roleData.permisos.length}`, inline: true }
        )
        .setTimestamp();

    await interaction.update({ embeds: [embed], components: [] });
}

async function handleMultipleSelect(interaction) {
    const parts = interaction.customId.split('_');
    const generadorId = parts[2];
    const rolId = parts[3];
    const pagina = parseInt(parts[4]) || 0;
    const seleccionados = interaction.values;

    const config = await tempVoiceSchema.findOne({
        guildId: interaction.guild.id,
        generatorChannelId: generadorId
    });

    if (!config) return interaction.update({ content: '❌ No encontrado.', components: [] });

    let roleData = config.rolesPermisos.find(r => r.roleId === rolId);

    if (!roleData) {
        roleData = {
            roleId: rolId,
            roleName: interaction.guild.roles.cache.get(rolId)?.name || '',
            permisos: [],
            puedeCrear: false,
            addedBy: interaction.user.id
        };
        config.rolesPermisos.push(roleData);
    }

    const PERMISOS_POR_PAGINA = 25;
    const inicio = pagina * PERMISOS_POR_PAGINA;
    const permisosPagina = TODOS_PERMISOS.slice(inicio, inicio + PERMISOS_POR_PAGINA).map(p => p.value);

    // Eliminar los permisos de esta página que ya no estén seleccionados
    roleData.permisos = roleData.permisos.filter(p => !permisosPagina.includes(p));
    // Añadir los nuevos seleccionados
    for (const p of seleccionados) {
        if (!roleData.permisos.includes(p)) roleData.permisos.push(p);
    }

    await config.save();

    const embed = new EmbedBuilder()
        .setColor('#0099FF')
        .setTitle('📋 Página Guardada')
        .setDescription(`Página ${pagina + 1} actualizada correctamente.\nTotal permisos activos: **${roleData.permisos.length}**`)
        .setFooter({ text: 'Navega entre páginas o presiona Finalizar' });

    await interaction.update({ embeds: [embed] });
}

async function handlePageNavigation(interaction) {
    const parts = interaction.customId.split('_');
    const generadorId = parts[2];
    const rolId = parts[3];
    const direction = parts[4];
    const currentPage = parseInt(parts[5]) || 0;
    const newPage = direction === 'next' ? currentPage + 1 : currentPage - 1;

    const config = await tempVoiceSchema.findOne({
        guildId: interaction.guild.id,
        generatorChannelId: generadorId
    });

    if (!config) return interaction.update({ content: '❌ No encontrado.', components: [] });

    const roleData = config.rolesPermisos.find(r => r.roleId === rolId);
    const permisosActuales = roleData?.permisos || [];

    const PERMISOS_POR_PAGINA = 25;
    const totalPaginas = Math.ceil(TODOS_PERMISOS.length / PERMISOS_POR_PAGINA);
    const inicio = newPage * PERMISOS_POR_PAGINA;
    const permisosPagina = TODOS_PERMISOS.slice(inicio, inicio + PERMISOS_POR_PAGINA);

    // Contar cuántos de esta página están activos
    const activosEnPagina = permisosPagina.filter(p => permisosActuales.includes(p.value)).length;

    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId(`tv_multiple_${generadorId}_${rolId}_${newPage}`)
        .setPlaceholder(`Página ${newPage + 1}/${totalPaginas} • ${activosEnPagina} activos aquí`)
        .setMinValues(0)
        .setMaxValues(permisosPagina.length)
        .addOptions(
            permisosPagina.map(p =>
                new StringSelectMenuOptionBuilder()
                    .setLabel(p.name)
                    .setValue(p.value)
                    .setEmoji(p.emoji)
                    // ¡ELIMINADO .setDefault() para evitar el bug de Discord!
            )
        );

    const botones = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`tv_page_${generadorId}_${rolId}_prev_${newPage}`)
            .setLabel('◀')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(newPage === 0),
        new ButtonBuilder()
            .setCustomId(`tv_page_info`)
            .setLabel(`${newPage + 1}/${totalPaginas}`)
            .setStyle(ButtonStyle.Primary)
            .setDisabled(true),
        new ButtonBuilder()
            .setCustomId(`tv_page_${generadorId}_${rolId}_next_${newPage}`)
            .setLabel('▶')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(newPage >= totalPaginas - 1),
        new ButtonBuilder()
            .setCustomId(`tv_finalizar_${generadorId}_${rolId}`)
            .setLabel('✅ Finalizar')
            .setStyle(ButtonStyle.Success)
    );

    const rol = interaction.guild.roles.cache.get(rolId);

    const embed = new EmbedBuilder()
        .setColor('#0099FF')
        .setTitle('📋 Añadir Múltiples Permisos')
        .setDescription(`Rol: ${rol || 'Rol desconocido'}\nTotal permisos activos: **${permisosActuales.length}**`)
        .addFields({
            name: '📊 Esta página',
            value: `${activosEnPagina} de ${permisosPagina.length} permisos están activos`,
            inline: false
        })
        .setFooter({ text: 'Selecciona los permisos deseados • Los cambios se guardan al cambiar de página o finalizar' });

    await interaction.update({
        embeds: [embed],
        components: [new ActionRowBuilder().addComponents(selectMenu), botones]
    });
}

async function handleFinalizar(interaction) {
    const [, , generadorId, rolId] = interaction.customId.split('_');

    const config = await tempVoiceSchema.findOne({
        guildId: interaction.guild.id,
        generatorChannelId: generadorId
    });

    const roleData = config?.rolesPermisos.find(r => r.roleId === rolId);
    const rol = interaction.guild.roles.cache.get(rolId);

    const agrupados = { generales: [], voz: [], texto: [] };
    for (const permiso of roleData?.permisos || []) {
        for (const [cat, perms] of Object.entries(CATEGORIAS_PERMISOS)) {
            const found = perms.find(p => p.value === permiso);
            if (found) {
                agrupados[cat].push(`${found.emoji}`);
                break;
            }
        }
    }

    let lista = '';
    if (agrupados.generales.length) lista += `**Generales:** ${agrupados.generales.join(' ')}\n`;
    if (agrupados.voz.length) lista += `**Voz:** ${agrupados.voz.join(' ')}\n`;
    if (agrupados.texto.length) lista += `**Texto:** ${agrupados.texto.join(' ')}\n`;

    const embed = new EmbedBuilder()
        .setColor('#00FF00')
        .setTitle('✅ Configuración Finalizada')
        .addFields(
            { name: '👥 Rol', value: `${rol || rolId}`, inline: true },
            { name: '📊 Total Permisos', value: `${roleData?.permisos.length || 0}`, inline: true },
            { name: '🔐 Permisos Activos', value: lista || 'Ninguno', inline: false }
        )
        .setTimestamp();

    await interaction.update({ embeds: [embed], components: [] });
}

// === EL RESTO DE FUNCIONES SIGUEN IGUALES (configuración, modales, etc.) ===

async function handleConfigMenu(interaction) {
    const generadorId = interaction.customId.split('_')[2];
    const opcion = interaction.values[0];

    const config = await tempVoiceSchema.findOne({
        guildId: interaction.guild.id,
        generatorChannelId: generadorId
    });

    if (!config) return interaction.update({ content: '❌ No encontrado.', components: [], embeds: [] });

    switch (opcion) {
        case 'name': return await showNameModal(interaction, generadorId, config);
        case 'limit': return await showLimitMenu(interaction, generadorId, config);
        case 'bitrate': return await showBitrateMenu(interaction, generadorId, config);
        case 'privacy': return await showPrivacyMenu(interaction, generadorId, config);
    }
}

async function showNameModal(interaction, generadorId, config) {
    const modal = new ModalBuilder()
        .setCustomId(`tv_name_modal_${generadorId}`)
        .setTitle('Cambiar Nombre');

    const input = new TextInputBuilder()
        .setCustomId('channel_name')
        .setLabel('Nombre ({user} = nombre de usuario)')
        .setStyle(TextInputStyle.Short)
        .setValue(config.settings.defaultName)
        .setRequired(true)
        .setMaxLength(100);

    modal.addComponents(new ActionRowBuilder().addComponents(input));
    await interaction.showModal(modal);
}

async function handleNameModal(interaction) {
    const generadorId = interaction.customId.split('_')[3];
    const newName = interaction.fields.getTextInputValue('channel_name');

    await tempVoiceSchema.findOneAndUpdate(
        { guildId: interaction.guild.id, generatorChannelId: generadorId },
        { 'settings.defaultName': newName }
    );

    const embed = new EmbedBuilder()
        .setColor('#00FF00')
        .setTitle('✅ Nombre Actualizado')
        .setDescription(`Formato: **\`${newName}\`**`)
        .setTimestamp();

    await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function showLimitMenu(interaction, generadorId, config) {
    const limits = [0, 2, 3, 5, 10, 15, 20, 25, 50, 99];

    const select = new StringSelectMenuBuilder()
        .setCustomId(`tv_limit_${generadorId}`)
        .setPlaceholder('Selecciona límite')
        .addOptions(limits.map(l =>
            new StringSelectMenuOptionBuilder()
                .setLabel(l === 0 ? 'Sin límite' : `${l} usuarios`)
                .setValue(l.toString())
                .setDefault(config.settings.userLimit === l)
        ));

    const embed = new EmbedBuilder()
        .setColor('#0099FF')
        .setTitle('👥 Límite de Usuarios')
        .setDescription(`Actual: **${config.settings.userLimit === 0 ? 'Sin límite' : config.settings.userLimit}**`);

    await interaction.update({ embeds: [embed], components: [new ActionRowBuilder().addComponents(select)] });
}

async function handleLimitSelect(interaction) {
    const generadorId = interaction.customId.split('_')[2];
    const newLimit = parseInt(interaction.values[0]);

    await tempVoiceSchema.findOneAndUpdate(
        { guildId: interaction.guild.id, generatorChannelId: generadorId },
        { 'settings.userLimit': newLimit }
    );

    const embed = new EmbedBuilder()
        .setColor('#00FF00')
        .setTitle('✅ Límite Actualizado')
        .setDescription(`Nuevo: **${newLimit === 0 ? 'Sin límite' : newLimit + ' usuarios'}**`)
        .setTimestamp();

    await interaction.update({ embeds: [embed], components: [] });
}

async function showBitrateMenu(interaction, generadorId, config) {
    const bitrates = [
        { label: '8 kbps', value: '8000' },
        { label: '32 kbps', value: '32000' },
        { label: '64 kbps', value: '64000' },
        { label: '96 kbps', value: '96000' },
        { label: '128 kbps', value: '128000' },
        { label: '256 kbps', value: '256000' },
        { label: '384 kbps', value: '384000' }
    ];

    const max = interaction.guild.maximumBitrate;

    const select = new StringSelectMenuBuilder()
        .setCustomId(`tv_bitrate_${generadorId}`)
        .setPlaceholder('Selecciona bitrate')
        .addOptions(bitrates.filter(b => parseInt(b.value) <= max).map(b =>
            new StringSelectMenuOptionBuilder()
                .setLabel(b.label)
                .setValue(b.value)
                .setDefault(config.settings.bitrate === parseInt(b.value))
        ));

    const embed = new EmbedBuilder()
        .setColor('#0099FF')
        .setTitle('🎵 Bitrate')
        .setDescription(`Actual: **${config.settings.bitrate / 1000} kbps**`);

    await interaction.update({ embeds: [embed], components: [new ActionRowBuilder().addComponents(select)] });
}

async function handleBitrateSelect(interaction) {
    const generadorId = interaction.customId.split('_')[2];
    const newBitrate = parseInt(interaction.values[0]);

    await tempVoiceSchema.findOneAndUpdate(
        { guildId: interaction.guild.id, generatorChannelId: generadorId },
        { 'settings.bitrate': newBitrate }
    );

    const embed = new EmbedBuilder()
        .setColor('#00FF00')
        .setTitle('✅ Bitrate Actualizado')
        .setDescription(`Nuevo: **${newBitrate / 1000} kbps**`)
        .setTimestamp();

    await interaction.update({ embeds: [embed], components: [] });
}

async function showPrivacyMenu(interaction, generadorId, config) {
    const select = new StringSelectMenuBuilder()
        .setCustomId(`tv_privacy_${generadorId}`)
        .setPlaceholder('Selecciona privacidad')
        .addOptions(
            new StringSelectMenuOptionBuilder()
                .setLabel('🔒 Privado')
                .setDescription('Solo roles configurados ven el canal')
                .setValue('true')
                .setDefault(config.settings.privateByDefault === true),
            new StringSelectMenuOptionBuilder()
                .setLabel('🔓 Público')
                .setDescription('Todos ven, solo roles configurados conectan')
                .setValue('false')
                .setDefault(config.settings.privateByDefault === false)
        );

    const embed = new EmbedBuilder()
        .setColor('#0099FF')
        .setTitle('🔒 Privacidad')
        .setDescription(`Actual: **${config.settings.privateByDefault ? 'Privado' : 'Público'}**`);

    await interaction.update({ embeds: [embed], components: [new ActionRowBuilder().addComponents(select)] });
}

async function handlePrivacySelect(interaction) {
    const generadorId = interaction.customId.split('_')[2];
    const isPrivate = interaction.values[0] === 'true';

    await tempVoiceSchema.findOneAndUpdate(
        { guildId: interaction.guild.id, generatorChannelId: generadorId },
        { 'settings.privateByDefault': isPrivate }
    );

    const embed = new EmbedBuilder()
        .setColor('#00FF00')
        .setTitle('✅ Privacidad Actualizada')
        .setDescription(`Canales serán: **${isPrivate ? '🔒 Privados' : '🔓 Públicos'}**`)
        .setTimestamp();

    await interaction.update({ embeds: [embed], components: [] });
}

async function handleDeleteChannel(interaction) {
    const channelId = interaction.customId.split('_')[2];
    const channel = interaction.guild.channels.cache.get(channelId);

    if (channel) {
        try {
            await channel.delete('Eliminado por admin');
            const embed = new EmbedBuilder()
                .setColor('#00FF00')
                .setTitle('✅ Canal Eliminado')
                .setTimestamp();
            await interaction.update({ embeds: [embed], components: [] });
        } catch (e) {
            await interaction.update({ content: `❌ Error: ${e.message}`, embeds: [], components: [] });
        }
    } else {
        await interaction.update({ content: '⚠️ Canal no existe.', embeds: [], components: [] });
    }
}

async function handleKeepChannel(interaction) {
    const embed = new EmbedBuilder()
        .setColor('#00FF00')
        .setTitle('✅ Configuración Eliminada')
        .setDescription('El canal se mantiene pero ya no es generador.')
        .setTimestamp();

    await interaction.update({ embeds: [embed], components: [] });
}