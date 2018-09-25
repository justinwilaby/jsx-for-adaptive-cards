import {LanguageClient} from 'vscode-languageclient';
import {clientOptions} from './clientOptions';
import {serverOptions} from '../server/serverOptions';

export class AdaptiveCardsExtensionClient extends LanguageClient {

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
