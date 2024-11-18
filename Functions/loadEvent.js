 async function loadEvents(client) {
    const ascii = require('ascii-table');
    const fs = require('fs');
    const table = new ascii();
    table.setHeading('Events', 'Status');


    await client.events.clear();

    const eventFolders = fs.readdirSync('./Events');

    for (const folder of eventFolders) {
        const eventFiles = fs.readdirSync(`./Events/${folder}`).filter(file => file.endsWith('.js'));
        for (const file of eventFiles) {
            const event = require(`../Events/${folder}/${file}`);

            if (event.rest) {
                if (event.once) {
                    client.once(event.name, (...args) => event.execute(...args, client));
                } else {
                    client.on(event.name, (...args) => event.execute(...args, client));
                }
            } else {
                if (event.once) {
                    client.once(event.name, (...args) => event.execute(...args, client));
                } else {
                    client.on(event.name, (...args) => event.execute(...args, client));
                }
            }
            table.addRow(file, 'Ready');
            continue;
        }

       
    }

    return console.log(table.toString() , '\nEvents Loaded');
}

module.exports = loadEvents