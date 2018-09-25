import {
  CompletionItem,
  CompletionList,
  CompletionParams,
  createConnection,
  Diagnostic,
  DidChangeConfigurationParams,
  DidChangeTextDocumentParams,
  DidChangeWatchedFilesParams,
  DidOpenTextDocumentParams,
  Hover,
  IConnection,
  InitializeParams,
  InitializeResult,
  IPCMessageReader,
  IPCMessageWriter,
  Range,
  TextDocumentContentChangeEvent,
  TextDocumentPositionParams
} from 'vscode-languageserver';
import { DiagnosticSeverity, TextDocumentSyncKind } from 'vscode-languageserver-protocol';
import { acxReporter } from '../utils/acxReporter';
import { getHoverInfo } from '../utils/getHoverInfo';
import { getCompletionList } from './completion';
import { findEntityAtPosition } from '../utils/findEntityAtPosition';

class AdaptiveCardsExtensionServer {
  private readonly connection: IConnection;
  private openDocuments: { [documentUri: string]: TextDocumentContentChangeEvent };

  /**
   *
   */
  constructor() {
    this.connection = createConnection(new IPCMessageReader(process), new IPCMessageWriter(process));
    this.openDocuments = {};
  }

  public start(): void {
    this.initializeConnection();
    this.connection.listen();
  }

  private initializeConnection(): void {
    const {connection} = this;
    connection.onInitialize(this.onInitialize);

    connection.onDidChangeConfiguration(this.onDidChangeConfiguration);
    connection.onDidChangeWatchedFiles(this.onDidChangeWatchedFiles);
    connection.onDidOpenTextDocument(this.onDidOpenTextDocument);
    connection.onDidChangeTextDocument(this.onDidChangeTextDocument);

    connection.onCompletion(this.onCompletion);
    connection.onCompletionResolve(this.onCompletionResolve);
    connection.onHover(this.onHover);
  }

  // --------------------------
  // Connection Handlers

  private onInitialize = (params: InitializeParams): InitializeResult => {
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
  };

  private onHover = async (event: TextDocumentPositionParams): Promise<Hover> => {
    const {position, textDocument} = event;
    const {uri} = textDocument;
    const document = this.openDocuments[uri];
    let hoverInfo;
    try {
      hoverInfo = await getHoverInfo(position, document);
    } catch (e) {

    }
    return hoverInfo;
  };

  private onDidChangeTextDocument = async (event: DidChangeTextDocumentParams): Promise<void> => {
    const {contentChanges, textDocument} = event;
    const {uri} = textDocument;
    const diagnostics: Diagnostic[] = [];
    const document = contentChanges[0].text;
    try {
      acxReporter(document);
    } catch (e) {
      const {loc = {}, message} = e;
      const entity = await findEntityAtPosition({line: loc.line - 1, character: loc.column}, document);

      const range: Range = entity.target === 'tag' ? {
        start: entity.tag.openStart,
        end: entity.tag.closeEnd
      } : {start: entity.start, end: entity.end};

      diagnostics.push({
        severity: DiagnosticSeverity.Error,
        source: 'ACX Validator',
        range,
        message: message.split('\n').shift().trim().replace('undefined: ', '')
      });
    }
    finally {
      this.openDocuments[uri] = contentChanges[0];
      this.connection.sendDiagnostics({uri, diagnostics});
    }
  };

  private onDidOpenTextDocument = (event: DidOpenTextDocumentParams): void => {
    const {textDocument} = event;
    const {uri} = textDocument;
    this.openDocuments[uri] = textDocument;

    try {
      acxReporter(textDocument.text);
    } catch {
      // no-op
    }
  };

  private onDidChangeConfiguration = (params: DidChangeConfigurationParams): void => {
  };

  private onDidChangeWatchedFiles = (change: DidChangeWatchedFilesParams): void => {
  };

  private onCompletion = async (completionParams: CompletionParams): Promise<CompletionItem[] | CompletionList | null> => {
    const {textDocument} = completionParams;
    const {uri} = textDocument;
    const document = this.openDocuments[uri];
    let items;
    try {
      items = await getCompletionList(completionParams, document);
    } catch (e) {

    }
    return items;
  };

  private onCompletionResolve = (completionItem: CompletionItem): CompletionItem => {
    return completionItem;
  }
}

const server = new AdaptiveCardsExtensionServer();
server.start();
