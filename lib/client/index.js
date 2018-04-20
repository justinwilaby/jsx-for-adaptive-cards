const {LanguageClient} = require('vscode-languageclient');
const clientOptions = require('./clientOptions');
const serverOptions = require('../server/serverOptions');

class AdaptiveCardsExtensionClient extends LanguageClient {

  /**
   * @property debugOptions
   */

  /**
   * @property clientOptions
   */

  constructor() {
    super('javaScriptAdaptiveCards', 'Adaptive Cards for JSX', serverOptions(), clientOptions());
  }
}

module.exports = {AdaptiveCardsExtensionClient};
