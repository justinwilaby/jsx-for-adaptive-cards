const {workspace} = require('vscode');

module.exports = function () {
  return {
    // Register the server for plain text documents
    documentSelector: [{scheme: 'file', language: 'javaScriptAdaptiveCards'}],
    synchronize: {
      configurationSection: 'javaScriptAdaptiveCards',
      // Notify the server about file changes to '.clientrc files contain in the workspace
      fileEvents: workspace.createFileSystemWatcher('**/.clientrc')
    }
  }
};
