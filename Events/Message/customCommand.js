const config = require('../../config.json');
const customCommandSchema = require('../../Models/customCommand');
const { Message, Client, EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'messageCreate',
    once: false,
    /**
     * @param {Message} message 
     * @param {Client} client 
     */
    async execute(message, client) {
        try {
            // Ignorar mensajes de bots
            if (message.author.bot) return;

            // Ignorar mensajes sin guild
            if (!message.guild) return;

            // Verificar si el mensaje empieza con el prefix
            if (!message.content.startsWith(config.PREFIX)) return;

            // Extraer el comando
            const args = message.content.slice(config.PREFIX.length).trim().split(/ +/);
            const commandName = args[0].toLowerCase();

            // Buscar el comando personalizado
            const customCmd = await customCommandSchema.findOne({
                guildId: message.guild.id,
                commandName: commandName
            });

            // Si no existe el comando, retornar
            if (!customCmd) return;

            console.log(`Comando personalizado ejecutado: ${commandName} por ${message.author.tag}`);

            // Verificar permisos del bot
            const botPermissions = message.channel.permissionsFor(message.guild.members.me);
            if (!botPermissions.has(['SendMessages', 'ViewChannel'])) {
                console.warn(`Bot no tiene permisos en ${message.channel.name}`);
                return;
            }

            // Procesar según el tipo de comando
            if (customCmd.tipo === 'texto') {
                // Comando de texto simple
                await handleTextoCommand(message, customCmd);
            } else if (customCmd.tipo === 'embed') {
                // Comando de embed
                await handleEmbedCommand(message, customCmd, botPermissions);
            }

        } catch (error) {
            console.error('Error ejecutando comando personalizado:', error);

            // Intentar notificar al usuario si es posible
            try {
                if (message.channel.permissionsFor(message.guild.members.me).has('SendMessages')) {
                    await message.reply({
                        content: '❌ Ocurrió un error al ejecutar este comando personalizado.',
                        allowedMentions: { repliedUser: false }
                    }).catch(() => { });
                }
            } catch (replyError) {
                console.error('Error al enviar mensaje de error:', replyError);
            }
        }
    }
};

/**
 * Maneja comandos de tipo texto
 * @param {Message} message - Mensaje original
 * @param {Object} customCmd - Comando personalizado
 */
async function handleTextoCommand(message, customCmd) {
    try {
        // Procesar la respuesta
        let response = customCmd.response;

        // Reemplazar variables dinámicas
        response = processVariables(response, message);

        // Reemplazar dobles espacios por saltos de línea
        response = response.replace(/  +/g, '\n');

        // Limitar longitud del mensaje
        if (response.length > 2000) {
            response = response.slice(0, 1997) + '...';
        }

        // Enviar el mensaje
        await message.channel.send({
            content: response,
            allowedMentions: {
                parse: ['users'],
                repliedUser: false
            }
        });

    } catch (error) {
        console.error('Error en handleTextoCommand:', error);
        throw error;
    }
}

/**
 * Maneja comandos de tipo embed
 * @param {Message} message - Mensaje original
 * @param {Object} customCmd - Comando personalizado
 * @param {import('discord.js').PermissionsBitField} botPermissions - Permisos del bot
 */
async function handleEmbedCommand(message, customCmd, botPermissions) {
    try {
        // Verificar permiso para enviar embeds
        if (!botPermissions.has('EmbedLinks')) {
            return message.reply({
                content: '❌ No tengo permisos para enviar embeds en este canal.',
                allowedMentions: { repliedUser: false }
            });
        }

        const embedData = customCmd.embedData;

        // Crear el embed
        const embed = new EmbedBuilder();

        // Color
        if (embedData.color) {
            embed.setColor(embedData.color);
        }

        // Título
        if (embedData.title) {
            let title = processVariables(embedData.title, message);
            if (title.length > 256) title = title.slice(0, 253) + '...';
            embed.setTitle(title);
        }

        // Descripción (requerida)
        if (embedData.description) {
            let description = processVariables(embedData.description, message);
            description = description.replace(/  +/g, '\n'); // Dobles espacios a saltos de línea
            if (description.length > 4096) description = description.slice(0, 4093) + '...';
            embed.setDescription(description);
        }

        // Footer
        if (embedData.footer) {
            let footer = processVariables(embedData.footer, message);
            if (footer.length > 2048) footer = footer.slice(0, 2045) + '...';
            embed.setFooter({ text: footer });
        }

        // Thumbnail
        if (embedData.thumbnail && isValidUrl(embedData.thumbnail)) {
            embed.setThumbnail(embedData.thumbnail);
        }

        // Imagen
        if (embedData.image && isValidUrl(embedData.image)) {
            embed.setImage(embedData.image);
        }

        // Fields (si los tiene)
        if (embedData.fields && Array.isArray(embedData.fields) && embedData.fields.length > 0) {
            const validFields = embedData.fields
                .filter(field => field.name && field.value)
                .slice(0, 25) // Máximo 25 fields
                .map(field => ({
                    name: processVariables(field.name, message).slice(0, 256),
                    value: processVariables(field.value, message).slice(0, 1024),
                    inline: field.inline || false
                }));

            if (validFields.length > 0) {
                embed.addFields(validFields);
            }
        }

        // Timestamp
        embed.setTimestamp();

        // Enviar el embed
        await message.channel.send({
            embeds: [embed],
            allowedMentions: {
                parse: ['users'],
                repliedUser: false
            }
        });

    } catch (error) {
        console.error('Error en handleEmbedCommand:', error);

        // Si es un error de imagen/thumbnail inválida
        if (error.code === 50035) {
            await message.reply({
                content: '❌ Error al cargar las imágenes del embed. Verifica que las URLs sean válidas.',
                allowedMentions: { repliedUser: false }
            }).catch(() => { });
        } else {
            throw error;
        }
    }
}

/**
 * Procesa variables dinámicas en el texto
 * @param {string} text - Texto a procesar
 * @param {Message} message - Mensaje original
 * @returns {string} Texto procesado
 */
function processVariables(text, message) {
    if (!text) return '';

    return text
        // Usuario
        .replace(/{user}/g, message.author.toString())
        .replace(/{username}/g, message.author.username)
        .replace(/{usertag}/g, message.author.tag)
        .replace(/{userid}/g, message.author.id)
        .replace(/{usermention}/g, `<@${message.author.id}>`)

        // Servidor
        .replace(/{server}/g, message.guild.name)
        .replace(/{serverid}/g, message.guild.id)
        .replace(/{servermembers}/g, message.guild.memberCount.toString())

        // Canal
        .replace(/{channel}/g, message.channel.name)
        .replace(/{channelid}/g, message.channel.id)
        .replace(/{channelmention}/g, `<#${message.channel.id}>`)

        // Fecha/Hora
        .replace(/{date}/g, new Date().toLocaleDateString('es-ES'))
        .replace(/{time}/g, new Date().toLocaleTimeString('es-ES'))
        .replace(/{datetime}/g, new Date().toLocaleString('es-ES'))

        // Bot
        .replace(/{botname}/g, message.client.user.username)
        .replace(/{bottag}/g, message.client.user.tag)
        .replace(/{botmention}/g, `<@${message.client.user.id}>`)

        // Saltos de línea especiales
        .replace(/\\n/g, '\n')
        .replace(/<br>/g, '\n');
}

/**
 * Valida si una URL es válida
 * @param {string} url - URL a validar
 * @returns {boolean} True si es válida
 */
function isValidUrl(url) {
    try {
        const urlObj = new URL(url);
        return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
    } catch (error) {
        return false;
    }
}
