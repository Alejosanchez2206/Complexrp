const config = require('../../config.json');
const { Message, Client } = require('discord.js');
const { io } = require('socket.io-client');

// Conexión al backend separado — se mantiene viva durante toda la ejecución del bot
const socket = io(config.url_socket);

socket.on('connect', () => console.log('🔗 Bot conectado al socket del backend'));
socket.on('disconnect', () => console.log('❌ Bot desconectado del socket del backend'));

module.exports = {
    name: 'messageCreate',
    once: false,
    /**
     * @param {Message} message
     * @param {Client} client
     */
    async execute(message, client) {
        if (message.author.id === client.user.id) return; // Ignorar solo el propio bot (el frontend ya lo agrega por REST)

        socket.emit('mensajeDiscord', {
            channelId: message.channelId,
            data: {
                id:        message.id,
                content:   message.content,
                timestamp: message.createdAt.toISOString(),
                edited:    message.editedAt?.toISOString() ?? null,
                author: {
                    id:       message.author.id,
                    username: message.author.username,
                    avatar:   message.author.avatar
                        ? `https://cdn.discordapp.com/avatars/${message.author.id}/${message.author.avatar}.png`
                        : null,
                    bot: message.author.bot ?? false,
                },
                attachments: message.attachments.map(a => ({
                    id:           a.id,
                    url:          a.url,
                    filename:     a.name,
                    content_type: a.contentType ?? null,
                    size:         a.size ?? null,
                })),
                embeds: message.embeds.map(e => e.toJSON?.() ?? e) ?? [],
            }
        });
    }
};