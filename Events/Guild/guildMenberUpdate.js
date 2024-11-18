const { Client, GatewayIntentBits } = require('discord.js');
const tabsSchema = require('../../Models/tabsStaffSchema');

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

            if (addedRoles.size > 0) {
                for (const role of addedRoles.values()) {
                    const roleData = await tabsSchema.findOne({ guildId, roleId: role.id });
                    if (roleData) {
                        const tab = roleData.tabStaff;
                        const username = newMember.user.username;
                        const newNickname = `『${tab}』${username}`;
                        await newMember.setNickname(newNickname);
                        console.log(`Nickname actualizado a: ${newNickname}`);
                        break; // Solo aplicamos la primera etiqueta encontrada
                    }
                }
            }

            if (removedRoles.size > 0) {
                for (const role of removedRoles.values()) {
                    const roleData = await RoleTab.findOne({ guildId, roleId: role.id });
                    if (roleData) {
                        // Verificar si el usuario tiene otros roles con etiquetas activas
                        const activeRole = await RoleTab.findOne({
                            guildId,
                            roleId: { $in: newMember.roles.cache.map((r) => r.id) },
                        });

                        if (!activeRole) {
                            // No tiene más roles con etiquetas
                            await newMember.setNickname(null); // Resetea el nickname
                            console.log(`Nickname reseteado para: ${newMember.user.username}`);
                        }
                        break; // Solo manejamos la primera etiqueta encontrada
                    }
                }
            }
        } catch (error) {
            console.error('Error al actualizar el nickname:', error);
        }

    }
}