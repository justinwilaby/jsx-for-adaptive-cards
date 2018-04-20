const {TransportKind} = require('vscode-languageclient');
const path = require('path');

module.exports = function () {
  const serverFilePath = path.resolve('lib/server/index.js');
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
};
