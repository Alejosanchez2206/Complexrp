
const { Client } = require('discord.js');
const mongoose = require('mongoose');
const config = require('../../config.json');
const { initializeStreamMonitor } = require('../stream/streamMonitor'); 
require('colors')

module.exports = {
    name: 'ready',
    once: true,
    /**
     * * @param {Client} client 
     * * 
     * */
    async execute(client) {
        
        await mongoose.connect(config.URL_MONGO).then(() => {
            console.log('Connected to MongoDB'.green);
        }).catch((err) => {
            console.log(err , '\nFailed to connect to MongoDB'.red);
        });

        console.log(`Logged in as ${client.user.tag}`);
        initializeStreamMonitor(client);
    }
}