const {createConnection, IPCMessageReader, IPCMessageWriter} = require('vscode-languageserver');
const {TextDocumentSyncKind, DiagnosticSeverity} = require('vscode-languageserver-protocol');
const {acxReporter} = require('../utils/acxReporter');
const {getHoverInfo} = require('../utils/getHoverInfo');
const {getCompletionList} = require('./completion');

class AdaptiveCardsExtensionServer {
  /**
   * @property connection
   */

  /**
   * @property {*} openDocuments
   */

  /**
   *
   */
  constructor() {
    this.connection = createConnection(new IPCMessageReader(process), new IPCMessageWriter(process));
    this.openDocuments = {};
  }

  initializeConnection() {
    const {connection} = this;
    connection.onInitialize(this.onInitialize.bind(this));

    connection.onDidChangeConfiguration(this.onDidChangeConfiguration.bind(this));
    connection.onDidChangeWatchedFiles(this.onDidChangeWatchedFiles.bind(this));
    connection.onDidOpenTextDocument(this.onDidOpenTextDocument.bind(this));
    connection.onDidChangeTextDocument(this.onDidChangeTextDocument.bind(this));

    connection.onCompletion(this.onCompletion.bind(this));
    connection.onCompletionResolve(this.onCompletionResolve.bind(this));
    connection.onHover(this.onHover.bind(this));
  }

  start() {
    this.initializeConnection();
    this.connection.listen();
  }

  //--------------------------
  // Connection Handlers

  onInitialize(params) {
    return {
      capabilities: {
        textDocumentSync: TextDocumentSyncKind.Full,
        hoverProvider: true,
        completionProvider: {
          resolveProvider: false,
          triggerCharacters: ['<']
        }
      }
    }
  }

  async onHover(event) {
    const {position, textDocument} = event;
    const {uri} = textDocument;
    const document = this.openDocuments[uri];
    return await getHoverInfo(position, document);
  }

  onDidChangeTextDocument(event) {
    const {contentChanges, textDocument} = event;
    const {uri, version} = textDocument;
    const diagnostics = [];
    try {
      acxReporter(contentChanges[0].text);
    } catch (e) {
      const {loc = {}, pos, message} = e;
      diagnostics.push({
        severity: DiagnosticSeverity.Error,
        source: 'ACX Validator',
        range: {
          start: {line: loc.line - 1, character: loc.column},
          end: {line: loc.line - 1, character: loc.column},
        },
        message: message.split('\n').shift().trim()
      });
    }
    finally {
      this.openDocuments[uri] = contentChanges[0];
      this.connection.sendDiagnostics({uri, diagnostics});
    }
  }

  onDidOpenTextDocument(event) {
    const {textDocument} = event;
    const {uri} = textDocument;
    this.openDocuments[uri] = textDocument;

    try {
      acxReporter(textDocument.text);
    } catch (e) {
    }
  }

  onDidChangeConfiguration(params) {
  }

  onDidChangeWatchedFiles(change) {
  }

  async onCompletion(completionParams) {
    const {textDocument} = completionParams;
    const {uri} = textDocument;
    const document = this.openDocuments[uri];
    const items = await getCompletionList(completionParams, document);
    return items;
  }

  onCompletionResolve(completionItem) {
    return completionItem;
  }
}

const server = new AdaptiveCardsExtensionServer();
server.start();
