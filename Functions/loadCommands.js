async function loadCommands(client) {
    const AsciiTable = require('ascii-table');
    const fs = require('fs');

    const table = new AsciiTable();
    table.setHeading('Command', 'Status');

    await client.commands.clear();

    let commandArray = [];

    const commandFolder = fs.readdirSync('./Commands');

    for (const folder of commandFolder) {
        const commandFiles = fs.readdirSync(`./Commands/${folder}`).filter(file => file.endsWith('.js'));
        for (const file of commandFiles) {
            const command = require(`../Commands/${folder}/${file}`);

            const properties = { folder, ...command }

            client.commands.set(command.data.name, properties)

            commandArray.push(command.data.toJSON());

            table.addRow(file, 'Ready');
            continue
        }
    }

    client.application.commands.set(commandArray);
    return console.log(table.toString(), '\nCommands Loaded');
}


module.exports = loadCommands;