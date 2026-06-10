
const { Client } = require('discord.js');
const mongoose = require('mongoose');
const config = require('../../config.json');
const { initializeStreamMonitor } = require('../stream/streamMonitor');
const dns = require('dns');
require('colors')

mongoose.set('strictQuery', true);
dns.setDefaultResultOrder('ipv4first');

module.exports = {
    name: 'ready',
    once: true,
    /**
     * * @param {Client} client 
     * * 
     * */
    async execute(client) {
        console.log("Intentando conectar a:", config.URL_MONGO);

        await mongoose.connect(config.URL_MONGO, { family: 4 }).then(() => {
            console.log('Connected to MongoDB'.green);
        }).catch((err) => {
            console.log(err, '\nFailed to connect to MongoDB'.red);
        });

        console.log(`Logged in as ${client.user.tag}`);
    }
}