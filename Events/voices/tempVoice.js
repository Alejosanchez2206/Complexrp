// events/tempVoice.js
const { Events, ChannelType, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const tempVoiceSchema = require('../../Models/tempVoiceConfig');

// Map para rastrear canales temporales activos
const activeTemporaryChannels = new Map();

// Configuración
const CLEANUP_INTERVAL = 60 * 1000;
const CHANNEL_EMPTY_GRACE_PERIOD = 10 * 1000;

// ===== MAPEO DE PERMISOS STRING A DISCORD FLAGS =====
const PERMISSION_FLAGS = {
    // Generales
    'ViewChannel': PermissionFlagsBits.ViewChannel,
    'ManageChannels': PermissionFlagsBits.ManageChannels,
    'ManageRoles': PermissionFlagsBits.ManageRoles,
    'CreateInstantInvite': PermissionFlagsBits.CreateInstantInvite,

    // Voz
    'Connect': PermissionFlagsBits.Connect,
    'Speak': PermissionFlagsBits.Speak,
    'Stream': PermissionFlagsBits.Stream,
    'UseVAD': PermissionFlagsBits.UseVAD,
    'PrioritySpeaker': PermissionFlagsBits.PrioritySpeaker,
    'MuteMembers': PermissionFlagsBits.MuteMembers,
    'DeafenMembers': PermissionFlagsBits.DeafenMembers,
    'MoveMembers': PermissionFlagsBits.MoveMembers,
    'UseSoundboard': PermissionFlagsBits.UseSoundboard,
    'UseExternalSounds': PermissionFlagsBits.UseExternalSounds,

    // Texto
    'SendMessages': PermissionFlagsBits.SendMessages,
    'EmbedLinks': PermissionFlagsBits.EmbedLinks,
    'AttachFiles': PermissionFlagsBits.AttachFiles,
    'AddReactions': PermissionFlagsBits.AddReactions,
    'UseExternalEmojis': PermissionFlagsBits.UseExternalEmojis,
    'ReadMessageHistory': PermissionFlagsBits.ReadMessageHistory,
    'ManageMessages': PermissionFlagsBits.ManageMessages
};

/**
 * Formatea el nombre del canal
 */
function formatChannelName(template, member) {
    return template
        .replace(/{user}/g, member.user.username)
        .replace(/{displayName}/g, member.displayName)
        .replace(/{tag}/g, member.user.tag)
        .replace(/{nickname}/g, member.nickname || member.displayName)
        .replace(/{id}/g, member.id);
}

/**
 * Convierte array de strings de permisos a flags de Discord
 */
function getPermissionBigInt(permisosArray) {
    let permissions = BigInt(0);

    for (const permiso of permisosArray) {
        if (PERMISSION_FLAGS[permiso]) {
            permissions |= PERMISSION_FLAGS[permiso];
        }
    }

    return permissions;
}

/**
 * Verifica si un miembro puede crear canales
 */
function canMemberCreate(member, config) {
    // Si no hay roles configurados, nadie puede crear
    if (!config.rolesPermisos || config.rolesPermisos.length === 0) {
        return { canCreate: false, roleData: null };
    }

    // Buscar si el miembro tiene algún rol con permiso de crear
    for (const roleConfig of config.rolesPermisos) {
        if (member.roles.cache.has(roleConfig.roleId) && roleConfig.puedeCrear) {
            return { canCreate: true, roleData: roleConfig };
        }
    }

    return { canCreate: false, roleData: null };
}

/**
 * Construye los permission overwrites para el canal temporal
 */
/**
 * Construye los permission overwrites para el canal temporal
 * - @everyone: según privacidad (público o privado)
 * - Roles configurados: permisos exactos de la DB
 * - Owner: NO recibe permisos extras → solo lo que le den sus roles
 */
function buildPermissionOverwrites(guild, member, config) {
    const overwrites = [];

    // === @everyone ===
    if (config.settings.privateByDefault) {
        // Privado: nadie ve ni conecta por defecto
        overwrites.push({
            id: guild.id,
            deny: [
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.Connect
            ]
        });
    } else {
        // Público: todos ven, pero nadie conecta sin permiso explícito
        overwrites.push({
            id: guild.id,
            allow: [PermissionFlagsBits.ViewChannel],
            deny: [PermissionFlagsBits.Connect]
        });
    }

    // === Roles configurados en el generador ===
    for (const roleConfig of config.rolesPermisos) {
        if (roleConfig.permisos.length === 0) continue;

        const allowFlags = roleConfig.permisos.map(perm => PermissionFlagsBits[perm]);

        overwrites.push({
            id: roleConfig.roleId,
            allow: allowFlags,
            deny: [] // No denegamos nada explícitamente a menos que sea necesario
        });
    }
 

    return overwrites;
}

module.exports = {
    name: Events.VoiceStateUpdate,
    once: false,

    /**
     * @param {import('discord.js').VoiceState} oldState
     * @param {import('discord.js').VoiceState} newState
     * @param {import('discord.js').Client} client
     */
    async execute(oldState, newState, client) {
        const member = newState.member || oldState.member;
        if (!member || member.user.bot) return;

        const guildId = newState.guild?.id || oldState.guild?.id;
        if (!guildId) return;

        // Usuario entra a un canal
        if (newState.channel && (!oldState.channel || oldState.channel.id !== newState.channel.id)) {
            await handleUserJoin(newState, client);
        }

        // Usuario sale de un canal
        if (oldState.channel && (!newState.channel || oldState.channel.id !== newState.channel.id)) {
            await handleUserLeave(oldState, client);
        }

        // Inicializar limpieza periódica
        if (!client._tempVoiceCleanupInitialized) {
            console.log('🧹 [TempVoice] Sistema de limpieza iniciado');
            setInterval(() => cleanupEmptyChannels(client), CLEANUP_INTERVAL);
            client._tempVoiceCleanupInitialized = true;
        }
    }
};

/**
 * Maneja cuando un usuario entra a un canal de voz
 */
async function handleUserJoin(voiceState, client) {
    const { channel, member, guild } = voiceState;

    // Buscar si es un canal generador
    const generatorConfig = await tempVoiceSchema.findOne({
        guildId: guild.id,
        generatorChannelId: channel.id
    });

    if (!generatorConfig) return;

    // Verificar si puede crear
    const { canCreate, roleData } = canMemberCreate(member, generatorConfig);

    if (!canCreate) {
        try {
            await member.voice.disconnect('No tienes permiso para crear canales temporales');

            // Obtener roles que pueden crear
            const rolesCreadores = generatorConfig.rolesPermisos
                .filter(r => r.puedeCrear)
                .map(r => `<@&${r.roleId}>`)
                .join(', ') || 'Ninguno configurado';

            await member.send({
                embeds: [
                    new EmbedBuilder()
                        .setColor('#FF0000')
                        .setTitle('❌ Acceso Denegado')
                        .setDescription(`No tienes permiso para crear canales de voz temporales en **${guild.name}**.`)
                        .addFields({
                            name: 'Roles que pueden crear canales',
                            value: rolesCreadores
                        })
                        .setTimestamp()
                ]
            }).catch(() => { });

        } catch (error) {
            console.error('[TempVoice] Error desconectando usuario:', error);
        }
        return;
    }

    // Crear canal temporal
    try {
        const { settings } = generatorConfig;
        const channelName = formatChannelName(settings.defaultName, member);

        // Construir permisos
        const permissionOverwrites = buildPermissionOverwrites(guild, member, generatorConfig);

        console.log(`[TempVoice] Creando canal para ${member.user.tag}`);
        console.log(`[TempVoice] Permisos a aplicar:`, permissionOverwrites.map(p => ({
            id: p.id,
            allow: p.allow?.toString(),
            deny: p.deny?.toString()
        })));

        // Crear el canal
        const tempChannel = await guild.channels.create({
            name: channelName,
            type: ChannelType.GuildVoice,
            parent: generatorConfig.categoryId,
            userLimit: settings.userLimit || 0,
            bitrate: Math.min(settings.bitrate || 64000, guild.maximumBitrate),
            permissionOverwrites,
            reason: `Canal temporal creado por ${member.user.tag}`
        });

        // Mover al usuario
        await member.voice.setChannel(tempChannel, 'Movido a su canal temporal');

        // Registrar el canal
        activeTemporaryChannels.set(tempChannel.id, {
            ownerId: member.id,
            guildId: guild.id,
            createdAt: Date.now(),
            generatorId: generatorConfig.generatorChannelId,
            categoryId: generatorConfig.categoryId
        });

        console.log(`🎤 [TempVoice] ${member.user.tag} creó "${channelName}"`);

        // Actualizar estadísticas
        await tempVoiceSchema.findByIdAndUpdate(generatorConfig._id, {
            $inc: { 'stats.totalCreated': 1 },
            'stats.lastUsed': new Date()
        });

    } catch (error) {
        console.error('[TempVoice] Error creando canal:', error);

        try {
            await member.voice.disconnect('Error al crear canal');
        } catch (e) {
            console.error('[TempVoice] Error desconectando:', e);
        }
    }
}

/**
 * Maneja cuando un usuario sale de un canal de voz
 */
async function handleUserLeave(voiceState, client) {
    const { channel, member, guild } = voiceState;

    const tempChannelData = activeTemporaryChannels.get(channel.id);
    if (!tempChannelData) return;

    const existingChannel = guild.channels.cache.get(channel.id);
    if (!existingChannel) {
        activeTemporaryChannels.delete(channel.id);
        return;
    }

    // Si el dueño sale
    if (member.id === tempChannelData.ownerId) {
        const remainingMembers = existingChannel.members.filter(m => !m.user.bot);

        if (remainingMembers.size > 0) {
            // Transferir propiedad
            const newOwner = remainingMembers.first();
            tempChannelData.ownerId = newOwner.id;

            try {
                // Dar permisos al nuevo dueño
                await existingChannel.permissionOverwrites.edit(newOwner.id, {
                    ViewChannel: true,
                    Connect: true,
                    Speak: true,
                    Stream: true,
                    UseVAD: true,
                    PrioritySpeaker: true,
                    MuteMembers: true,
                    DeafenMembers: true,
                    MoveMembers: true,
                    ManageChannels: true
                });

                // Quitar permisos especiales al dueño anterior
                await existingChannel.permissionOverwrites.delete(member.id).catch(() => { });

                // Renombrar
                const config = await tempVoiceSchema.findOne({
                    guildId: guild.id,
                    generatorChannelId: tempChannelData.generatorId
                });

                if (config) {
                    const newName = formatChannelName(config.settings.defaultName, newOwner);
                    await existingChannel.setName(newName, 'Transferencia de propiedad');
                }

                console.log(`🔄 [TempVoice] Propiedad transferida a ${newOwner.user.tag}`);

            } catch (error) {
                console.error('[TempVoice] Error transfiriendo propiedad:', error);
            }
        }
    }

    // Si el canal quedó vacío
    if (existingChannel.members.filter(m => !m.user.bot).size === 0) {
        setTimeout(async () => {
            const recheckChannel = guild.channels.cache.get(channel.id);
            if (recheckChannel && recheckChannel.members.filter(m => !m.user.bot).size === 0) {
                try {
                    await recheckChannel.delete('Canal temporal vacío');
                    activeTemporaryChannels.delete(channel.id);
                    console.log(`🗑️ [TempVoice] Canal "${recheckChannel.name}" eliminado`);
                } catch (error) {
                    console.error('[TempVoice] Error eliminando canal:', error);
                }
            }
        }, CHANNEL_EMPTY_GRACE_PERIOD);
    }
}

/**
 * Limpia canales temporales vacíos
 */
async function cleanupEmptyChannels(client) {
    for (const [channelId, data] of activeTemporaryChannels.entries()) {
        const guild = client.guilds.cache.get(data.guildId);
        if (!guild) {
            activeTemporaryChannels.delete(channelId);
            continue;
        }

        const channel = guild.channels.cache.get(channelId);

        if (!channel) {
            activeTemporaryChannels.delete(channelId);
            continue;
        }

        if (channel.members.filter(m => !m.user.bot).size === 0) {
            try {
                await channel.delete('Limpieza automática');
                activeTemporaryChannels.delete(channelId);
                console.log(`🧹 [TempVoice] Canal "${channel.name}" limpiado`);
            } catch (error) {
                console.error(`[TempVoice] Error limpiando ${channelId}:`, error);
            }
        }
    }
}

// Exportar para uso externo
module.exports.activeTemporaryChannels = activeTemporaryChannels;
module.exports.PERMISSION_FLAGS = PERMISSION_FLAGS;