const config = require('../../config.json');
const { Message, Client, EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'messageCreate',
    once: false,
    
    /**
     * Maneja los mensajes entrantes para detectar spam
     * @param {Message} message - El mensaje recibido
     * @param {Client} client - El cliente de Discord
     */
    async execute(message, client) {
        // Verificaciones iniciales
        if (!this.shouldProcessMessage(message)) return;
        
        try {
            const member = message.guild.members.cache.get(message.author.id);
            const logChannel = client.channels.cache.get(config.ChannelLogs);
            
            if (!logChannel) {
                console.error('❌ Canal de logs no encontrado');
                return;
            }
            
            // Intentar banear al usuario
            if (member.bannable) {
                await this.banSpammer(member, logChannel, message);
            } else {
                await this.logUnbannableSpammer(member, logChannel, message, client);
            }
            
        } catch (error) {
            console.error('❌ Error procesando detección de spam:', error);
        }
    },
    
    /**
     * Verifica si el mensaje debe ser procesado
     * @param {Message} message - El mensaje a verificar
     * @returns {boolean} - True si debe procesarse
     */
    shouldProcessMessage(message) {
        // Ignorar bots y mensajes directos
        if (message.author.bot || !message.guild) {
            console.log('ℹ️  Mensaje ignorado: bot o DM');
            return false;
        }
        
        // Verificar canal anti-spam
        if (message.channel.id !== config.AntiSpamChannel) {
            console.log(`ℹ️  Mensaje no está en canal anti-spam: ${message.channel.name}`);
            return false;
        }
        
        return true;
    },
    
    /**
     * Banea al usuario spammer y registra la acción
     * @param {GuildMember} member - El miembro a banear
     * @param {TextChannel} logChannel - Canal de logs
     * @param {Message} message - Mensaje original
     */
    async banSpammer(member, logChannel, message) {
        try {
            // Aplicar ban permanente
            await member.ban({
                reason: 'Detección automática de spam - Moderación Complex Legacy',
                deleteMessageSeconds: 604800 // Elimina mensajes de los últimos 7 días
            });
            
            console.log(`✅ Usuario baneado por spam: ${message.author.tag}`);
            
            // Crear embed de confirmación
            const banEmbed = this.createBanEmbed(message);
            await logChannel.send({ embeds: [banEmbed] });
            
        } catch (error) {
            console.error(`❌ Error al banear usuario ${message.author.tag}:`, error);
            
            // Enviar embed de error
            const errorEmbed = this.createErrorEmbed(message, 'Error al aplicar el ban');
            await logChannel.send({ embeds: [errorEmbed] });
        }
    },
    
    /**
     * Registra cuando no se puede banear un usuario
     * @param {GuildMember} member - El miembro que no se pudo banear
     * @param {TextChannel} logChannel - Canal de logs
     * @param {Message} message - Mensaje original
     * @param {Client} client - Cliente de Discord
     */
    async logUnbannableSpammer(member, logChannel, message, client) {
        console.warn(`⚠️  No se puede banear usuario: ${message.author.tag} - Permisos insuficientes`);
        
        const unbanEmbed = this.createUnbannableEmbed(message, client);
        await logChannel.send({ embeds: [unbanEmbed] });
    },
    
    /**
     * Crea embed para ban exitoso
     * @param {Message} message - Mensaje original
     * @returns {EmbedBuilder} - Embed construido
     */
    createBanEmbed(message) {
        return new EmbedBuilder()
            .setTitle('🔨 Usuario Baneado por Spam')
            .setDescription(
                `**Usuario:** ${message.author.tag} (\`${message.author.id}\`)\n` +
                `**Canal:** ${message.channel}\n` +
                `**Motivo:** Detección automática de spam\n\n` +
                `**📋 Acciones aplicadas:**\n` +
                `• ✅ Ban permanente aplicado\n` +
                `• 🗑️ Mensajes eliminados (últimos 7 días)\n` +
                `• 📝 Registro en logs del servidor`
            )
            .setColor('#DC3545') // Rojo Bootstrap
            .setThumbnail(message.author.displayAvatarURL({ dynamic: true }))
            .addFields([
                {
                    name: '🔗 Información del canal',
                    value: `**Nombre:** #${message.channel.name}\n**ID:** \`${message.channel.id}\``,
                    inline: true
                },
                {
                    name: '⏰ Fecha del incidente',
                    value: `<t:${Math.floor(Date.now() / 1000)}:F>`,
                    inline: true
                }
            ])
            .setFooter({
                text: `Sistema Anti-Spam • ${message.guild.name}`,
                iconURL: message.guild.iconURL() || undefined
            })
            .setTimestamp();
    },
    
    /**
     * Crea embed para usuarios no baneables
     * @param {Message} message - Mensaje original
     * @param {Client} client - Cliente de Discord
     * @returns {EmbedBuilder} - Embed construido
     */
    createUnbannableEmbed(message, client) {
        return new EmbedBuilder()
            .setTitle('⚠️ Spam Detectado - No se Pudo Banear')
            .setDescription(
                `**Usuario:** ${message.author.tag} (\`${message.author.id}\`)\n` +
                `**Canal:** ${message.channel}\n` +
                `**Estado:** Detección de spam confirmada\n\n` +
                `**❌ Problema encontrado:**\n` +
                `No se pudo aplicar el ban por una de estas razones:\n` +
                `• El usuario tiene permisos superiores\n` +
                `• El bot no tiene permisos suficientes\n` +
                `• El usuario es propietario del servidor\n\n` +
                `**🔧 Acción requerida:**\n` +
                `Intervención manual necesaria por parte de un moderador.`
            )
            .setColor('#FFC107') // Amarillo de advertencia
            .setThumbnail(message.author.displayAvatarURL({ dynamic: true }))
            .addFields([
                {
                    name: '🔗 Información del canal',
                    value: `**Nombre:** #${message.channel.name}\n**ID:** \`${message.channel.id}\``,
                    inline: true
                },
                {
                    name: '⏰ Fecha del incidente',
                    value: `<t:${Math.floor(Date.now() / 1000)}:F>`,
                    inline: true
                }
            ])
            .setFooter({
                text: `Sistema Anti-Spam • ${message.guild.name}`,
                iconURL: client.user.displayAvatarURL()
            })
            .setTimestamp();
    },
    
    /**
     * Crea embed para errores
     * @param {Message} message - Mensaje original
     * @param {string} errorType - Tipo de error
     * @returns {EmbedBuilder} - Embed construido
     */
    createErrorEmbed(message, errorType) {
        return new EmbedBuilder()
            .setTitle('💥 Error en Sistema Anti-Spam')
            .setDescription(
                `**Error:** ${errorType}\n` +
                `**Usuario:** ${message.author.tag} (\`${message.author.id}\`)\n` +
                `**Canal:** ${message.channel}\n\n` +
                `Se detectó spam pero ocurrió un error al procesar la sanción.\n` +
                `Revisar logs del sistema para más detalles.`
            )
            .setColor('#6C757D') // Gris
            .setThumbnail(message.author.displayAvatarURL({ dynamic: true }))
            .setFooter({
                text: `Sistema Anti-Spam • ${message.guild.name}`,
                iconURL: message.guild.iconURL() || undefined
            })
            .setTimestamp();
    }
};