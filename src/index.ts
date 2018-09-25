const {AdaptiveCardsExtensionClient} = require('./client/index');

export const activate = (context) => {
  const client = new AdaptiveCardsExtensionClient();
  context.subscriptions.push(client.start());
};
