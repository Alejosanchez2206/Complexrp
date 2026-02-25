const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const tabsSchema = require('../../Models/tabsStaffSchema');

// Configura aquí el ID del canal donde se enviarán los logs
const LOG_CHANNEL_ID = '1472718177724010730'; // Reemplaza con tu ID de canal

// Variable para guardar el ID del último mensaje enviado
let lastMessageId = null;

module.exports = {
    name: 'guildMemberUpdate',
    once: false,
    /**
     * 
     * @param {GuildMember} oldMember
     * @param {GuildMember} newMember
     * @param {Client} client
     */
    async execute(oldMember, newMember, client) {
        try {
            // Obtener roles agregados o eliminados
            const addedRoles = newMember.roles.cache.filter((role) => !oldMember.roles.cache.has(role.id));
            const removedRoles = oldMember.roles.cache.filter((role) => !newMember.roles.cache.has(role.id));

            // Consulta MongoDB para encontrar roles con etiquetas
            const guildId = newMember.guild.id;
            let roleUpdated = null;

            if (addedRoles.size > 0) {
                for (const role of addedRoles.values()) {
                    const roleData = await tabsSchema.findOne({ guildId, roleId: role.id });
                    if (roleData) {
                        const tab = roleData.tabStaff;
                        const username = newMember.user.username;
                        const newNickname = `${tab} ${username}`;
                        await newMember.setNickname(newNickname);
                        roleUpdated = role;
                        break;
                    }
                }
            }

            if (removedRoles.size > 0) {
                for (const role of removedRoles.values()) {
                    const roleData = await tabsSchema.findOne({ guildId, roleId: role.id });
                    if (roleData) {
                        // Verificar si el usuario tiene otros roles con etiquetas activas
                        const activeRole = await tabsSchema.findOne({
                            guildId,
                            roleId: { $in: newMember.roles.cache.map((r) => r.id) },
                        });

                        if (!activeRole) {
                            await newMember.setNickname(null);
                        } else {
                            const tab = activeRole.tabStaff;
                            const username = newMember.user.username;
                            const newNickname = `${tab} ${username}`;
                            await newMember.setNickname(newNickname);
                        }
                        roleUpdated = role;
                        break;
                    }
                }
            }

            // Si se actualizó un rol con tab staff, enviar lista de TODOS los usuarios del staff
            if (roleUpdated) {
                await sendAllStaffList(newMember.guild, roleUpdated, client);
            }

        } catch (error) {
            console.error('Error al actualizar el nickname:', error);
        }
    }
}

/**
 * Envía una lista de TODOS los usuarios del staff, ordenados por jerarquía
 * @param {Guild} guild
 * @param {Role} triggerRole - El rol que activó la actualización
 * @param {Client} client
 */
async function sendAllStaffList(guild, triggerRole, client) {
    try {
        // Obtener el canal fijo
        const targetChannel = guild.channels.cache.get(LOG_CHANNEL_ID);
        
        if (!targetChannel || !targetChannel.isTextBased()) {
            console.error(`No se encontró el canal con ID: ${LOG_CHANNEL_ID}`);
            return;
        }

        // Eliminar el mensaje anterior si existe
        if (lastMessageId) {
            try {
                const oldMessage = await targetChannel.messages.fetch(lastMessageId);
                await oldMessage.delete();
            } catch (error) {
                console.log('No se pudo eliminar el mensaje anterior:', error.message);
            }
        }

        // Obtener todos los roles del staff desde la base de datos (orden ascendente, 1 es el más alto)
        const allStaffRoles = await tabsSchema.find({ guildId: guild.id }).sort({ orden: 1 });
        
        if (allStaffRoles.length === 0) {
            console.log('No hay roles de staff configurados');
            return;
        }

        // Crear un mapa de roleId -> orden para búsqueda rápida
        const roleOrderMap = new Map();
        allStaffRoles.forEach(roleData => {
            roleOrderMap.set(roleData.roleId, roleData.orden || 999);
        });

        // Obtener TODOS los miembros que tengan al menos un rol de staff
        const allStaffMembers = new Map(); // Usar Map para evitar duplicados
        
        for (const staffRoleData of allStaffRoles) {
            const role = guild.roles.cache.get(staffRoleData.roleId);
            if (role) {
                role.members.forEach(member => {
                    if (!allStaffMembers.has(member.id)) {
                        allStaffMembers.set(member.id, member);
                    }
                });
            }
        }

        const membersArray = Array.from(allStaffMembers.values());

        // Ordenar miembros por el rol más alto que tengan en el sistema de staff
        membersArray.sort((a, b) => {
            const aHighestOrder = getHighestRoleOrder(a, roleOrderMap);
            const bHighestOrder = getHighestRoleOrder(b, roleOrderMap);
            return aHighestOrder - bHighestOrder; // Orden ascendente (1 primero)
        });

        // Agrupar usuarios por su rol más alto
        const groupedMembers = {};
        
        for (const member of membersArray) {
            const highestStaffRole = getHighestStaffRole(member, allStaffRoles);
            const roleName = highestStaffRole ? highestStaffRole.tabStaff : 'Sin rol de staff';
            
            if (!groupedMembers[roleName]) {
                groupedMembers[roleName] = [];
            }
            groupedMembers[roleName].push(member);
        }

        // Construir la descripción del embed
        let description = '';
        const sortedRoleNames = Object.keys(groupedMembers).sort((a, b) => {
            const aRole = allStaffRoles.find(r => r.tabStaff === a);
            const bRole = allStaffRoles.find(r => r.tabStaff === b);
            const aOrder = aRole ? aRole.orden : 999;
            const bOrder = bRole ? bRole.orden : 999;
            return aOrder - bOrder; // Orden ascendente (1 primero)
        });

        for (const roleName of sortedRoleNames) {
            const count = groupedMembers[roleName].length;
            description += `\n**${roleName}** (${count})\n`;
            groupedMembers[roleName].forEach(member => {
                description += `• <@${member.user.id}>\n`;
            });
        }

        if (description === '') {
            description = 'No hay usuarios con roles de staff actualmente.';
        }

        // Crear el embed con el nombre del servidor
        const embed = new EmbedBuilder()
            .setTitle(`📋 Lista de Staff - ${guild.name}`)
            .setColor(triggerRole.color || '#5865F2')
            .setDescription(`**Total de usuarios: ${membersArray.length}**\n${description}`)
            .setTimestamp()
            .setFooter({ text: `Actualizado por cambio en: ${triggerRole.name}` });

        const sentMessage = await targetChannel.send({ embeds: [embed] });
        
        // Guardar el ID del mensaje enviado
        lastMessageId = sentMessage.id;

    } catch (error) {
        console.error('Error al enviar la lista de usuarios:', error);
    }
}

/**
 * Obtiene el orden más alto de los roles de staff que tiene un miembro (menor número = mayor jerarquía)
 * @param {GuildMember} member
 * @param {Map} roleOrderMap
 * @returns {number}
 */
function getHighestRoleOrder(member, roleOrderMap) {
    let highestOrder = 999; // Valor por defecto alto
    
    member.roles.cache.forEach(role => {
        const order = roleOrderMap.get(role.id);
        if (order !== undefined && order < highestOrder) {
            highestOrder = order;
        }
    });
    
    return highestOrder;
}

/**
 * Obtiene el rol de staff más alto que tiene un miembro (menor número = mayor jerarquía)
 * @param {GuildMember} member
 * @param {Array} allStaffRoles
 * @returns {Object|null}
 */
function getHighestStaffRole(member, allStaffRoles) {
    let highestRole = null;
    let highestOrder = 999; // Valor por defecto alto
    
    for (const staffRole of allStaffRoles) {
        if (member.roles.cache.has(staffRole.roleId)) {
            const order = staffRole.orden || 999;
            if (order < highestOrder) { // Menor número = mayor jerarquía
                highestOrder = order;
                highestRole = staffRole;
            }
        }
    }
    
    return highestRole;
}