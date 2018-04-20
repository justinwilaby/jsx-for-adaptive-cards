const {AdaptiveCardsExtensionClient} = require('./client');

function activate(context) {
  const client = new AdaptiveCardsExtensionClient();
  context.subscriptions.push(client.start());
}

module.exports = {activate};
