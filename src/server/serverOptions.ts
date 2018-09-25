import * as path from 'path';
import {ServerOptions, TransportKind} from 'vscode-languageclient';

export function serverOptions(): ServerOptions {
  const serverFilePath = path.join(__dirname, 'index.js');
  return {
    run: {
      module: serverFilePath,
      transport: TransportKind.ipc
    },
    debug: {
      module: serverFilePath,
      transport: TransportKind.ipc,
      options: {
        execArgv: ['--nolazy', '--inspect=22437']
      }
    }
  }
}
