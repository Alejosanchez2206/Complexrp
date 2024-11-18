const { Client, GatewayIntentBits, Partials, Collection } = require('discord.js');
const config = require('./config.json');
const  loadEvents  = require('./Functions/loadEvent');
const loadCommands  = require('./Functions/loadCommands');

const client = new Client({
    intents: [Object.keys(GatewayIntentBits)],
    partials: [Object.keys(Partials)]
})

client.commands = new Collection();
client.events = new Collection();

client.setMaxListeners(0);

client.login(config.TOKEN).then( async() => {
    await loadCommands(client);
    await loadEvents(client);
}).catch((err) => {
    console.log(err);
})