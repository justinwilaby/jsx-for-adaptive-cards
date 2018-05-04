const {TransportKind} = require('vscode-languageclient');
const path = require('path');

module.exports = function () {
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
};
