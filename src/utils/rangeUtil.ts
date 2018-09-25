import {Position, Range} from 'vscode-languageserver-types';

export function rangeUtil(range: Range, position: Position): boolean {

  if (position.line < range.start.line || position.line > range.end.line) {
    return false;
  }

  if (position.line === range.start.line && position.character < range.start.character) {
    return false;
  }

  return !(position.line === range.end.line && position.character > range.end.character);
}
