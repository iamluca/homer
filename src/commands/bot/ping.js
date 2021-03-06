const Command = require('../../structures/Command');

class PingCommand extends Command {
  constructor(client) {
    super(client, {
      name: 'ping',
      aliases: ['pong', 'peng', 'pung'],
      category: 'bot',
      dm: true,
    });
  }

  async execute(context) {
    const sentMessage = await context.reply(context.__('ping.ping'));
    sentMessage.edit(context.__('ping.pong', {
      api: Math.floor(this.client.ping),
      heartbeat: (sentMessage.createdTimestamp - context.message.createdTimestamp),
    }));
  }
}

module.exports = PingCommand;
