import {findEntityAtPosition} from './findEntityAtPosition';
import {getSchemaFragment, getSchemaPropertyInfo} from './schemaUtil';
import {Position} from 'sax-wasm/lib';
import {Hover, TextDocumentContentChangeEvent} from 'vscode-languageserver-types';

export async function getHoverInfo(position: Position, document: TextDocumentContentChangeEvent): Promise<Hover | null> {
  const entity = await findEntityAtPosition(position, document.text);
  const {target} = entity;

  if (!target) {
    return;
  }
  if (target === 'tag') {
    const {description: contents = ''} = getSchemaFragment(entity);
    return {contents};
  }

  if (target === 'attributeName') {
    const targetProperty = getSchemaPropertyInfo(entity);
    return {contents: targetProperty.description};
  }

  if (target === 'attributeValue') {
    const targetProperty = getSchemaPropertyInfo(entity);
    const {'enum': enums, type} = targetProperty;
    if (enums) {
      return {contents: `Valid values are ${arrayToHumanString(enums)}`};
    }
    if (type) {
      return {contents: `Can be type ${arrayToHumanString(type)}`}
    }
  }
}

function arrayToHumanString(array): string {
  if (!Array.isArray(array)) {
    return array.toString();
  }
  const commaSeparated = array.slice(0, array.length - 1);
  return commaSeparated.join(', ').concat(` or ${array[array.length - 1]}`);
}

module.exports = {getHoverInfo};
