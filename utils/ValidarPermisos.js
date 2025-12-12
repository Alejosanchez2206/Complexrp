const { PermissionFlagsBits } = require('discord.js');
const permisosSchema = require('../Models/addPermisos');

/**
 * Valida si un usuario tiene un permiso específico
 * @param {import('discord.js').CommandInteraction} interaction - La interacción del comando
 * @param {string} permisoRequerido - El permiso a validar
 * @returns {Promise<boolean>} - True si tiene el permiso, false si no
 */
const validarPermiso = async (interaction, permisoRequerido) => {
    try {
        const member = interaction.member;

        // Si es administrador, siempre tiene permiso
        if (member.permissions.has(PermissionFlagsBits.Administrator)) {
            console.log(`[PERMISOS] ${member.user.tag} tiene permiso '${permisoRequerido}' (es administrador)`);
            return true;
        }

        const rolesDelMiembro = member.roles.cache;

        // Buscar permisos en cada rol del miembro
        for (const [roleId, role] of rolesDelMiembro) {
            const permisoData = await permisosSchema.findOne({
                guild: interaction.guild.id,
                rol: roleId
            });

            // Verificar si el rol tiene el permiso específico
            if (permisoData && permisoData.permisos && Array.isArray(permisoData.permisos)) {
                if (permisoData.permisos.includes(permisoRequerido)) {
                    console.log(`[PERMISOS] ${member.user.tag} tiene permiso '${permisoRequerido}' via rol ${role.name}`);
                    return true;
                }
            }
        }

        console.log(`[PERMISOS] ${member.user.tag} NO tiene permiso '${permisoRequerido}'`);
        return false;

    } catch (error) {
        console.error('Error al validar permiso:', error);
        return false;
    }
};

module.exports = validarPermiso;