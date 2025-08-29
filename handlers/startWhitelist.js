const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle  } = require('discord.js');
const questionsSchema = require('../Models/questions');
const whitelistSchema = require('../Models/whitelistSystemSchema');
const userBlacklist = require('../Models/blackUser');
const sessionManager = require('../utils/SessionManager');
const sendQuestionEmbed = require('./sendQuestionEmbed');

module.exports = async (interaction) => {
    const rolesUser = interaction.member.roles.cache.map(r => r.id);
    const responseData = await whitelistSchema.findOne({ guildId: interaction.guild.id });
    const isBlacklisted = await userBlacklist.findOne({ userId: interaction.user.id });

    const button = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('WhitelistSystemAccept').setStyle(ButtonStyle.Success).setEmoji('✅').setLabel('Aceptar'),
        new ButtonBuilder().setCustomId('WhitelistSystemDeclineButton').setStyle(ButtonStyle.Danger).setEmoji('❌').setLabel('Denegar')
    );

    if (!responseData || !responseData.channelSend) {
        return interaction.reply({ content: '❌ El sistema de whitelist no está configurado.', ephemeral: true });
    }

    if (isBlacklisted) {
        return interaction.reply({ content: '❌ Estas asignado a la blacklist de la comunidad.', ephemeral: true });
    }

    if (rolesUser.includes(responseData.roleId)) {
        return interaction.reply({ content: '✅ Ya tienes tu rol de whitelist.', ephemeral: true });
    }

    const guildId = interaction.guild.id;
    const [textQuestions, selectQuestions] = await Promise.all([
        questionsSchema.aggregate([{ $match: { guildId, type: 'text' } }, { $sample: { size: 7 } }]),
        questionsSchema.aggregate([{ $match: { guildId, type: 'select' } }, { $sample: { size: 3 } }])
    ]);

    const personalQuestions = [
        { question: '¿Qué edad tienes (OOC)?', type: 'text' },
        { question: '¿Por qué quieres ser parte de la comunidad? ¿Qué servidores has visitado?', type: 'text' },
        {
            question: 'Escribe la historia de tu personaje:\nNombre:\nDescripción física y de personalidad:\nHistoria:\n(Si superas los 900 caracteres, puedes subir un enlace de Google Docs).',
            type: 'text'
        }
    ];

    const questions = [...textQuestions, ...selectQuestions, ...personalQuestions];

    if (questions.length === 0) {
        return interaction.reply({ content: '❌ No hay preguntas disponibles.', ephemeral: true });
    }

    await sessionManager.createSession(interaction.user.id, {
        currentQuestion: 0,
        responses: [],
        questions
    });

    await sendQuestionEmbed(interaction, questions[0], 0, questions.length);
};