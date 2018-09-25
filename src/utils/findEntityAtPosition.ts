import * as fs from 'fs';
import { Position, SaxEventType, SAXParser, Tag } from 'sax-wasm';
import { rangeUtil } from './rangeUtil';
import { Attribute } from 'sax-wasm/lib';

const saxPath = require.resolve('sax-wasm/lib/sax-wasm.wasm');
const saxWasmBuffer = fs.readFileSync(saxPath);
let parserReady;
const parser = new SAXParser(SaxEventType.OpenTag | SaxEventType.CloseTag);

export interface DocumentEntity {
  target: 'tag' | 'attributeValue' | 'attributeName';
  substr: string;
  start: Position,
  end: Position,
  attribute?: Attribute,
  tag?: Tag;
  parent?: Tag;
}

export async function findEntityAtPosition(position: Position, documentText: string): Promise<DocumentEntity> {
  let entity: DocumentEntity = null;
  let tags: Tag[] = [];

  parser.eventHandler = (event: SaxEventType, tag: Tag) => {
    if (entity) {
      return;
    }

    if (event === SaxEventType.OpenTag) {
      tags.push(tag);
    }

    if (event === SaxEventType.CloseTag) {
      tags.pop();
      entity = getTagEntity(position, tag);
    }

    if (entity && tags.length) {
      entity.parent = tags[tags.length - 1];
    }
  };

  if (!parserReady) {
    parserReady = await parser.prepareWasm(saxWasmBuffer);
  }
  try {
    parser.write(documentText);
  } catch (e) {
    // Skip over these
  } finally {
    parser.end();
  }

  return entity || {} as DocumentEntity;
}

function hitTestAttribute(position: Position, attribute: Attribute): DocumentEntity {
  const {nameStart, nameEnd, valueStart, valueEnd} = attribute;
  let targetPosition = {start: nameStart, end: nameEnd};
  if (rangeUtil(targetPosition, position)) {
    return {
      ...targetPosition,
      attribute,
      target: 'attributeName',
      substr: attribute.name.substr(0, position.character - nameStart.character)
    };
  }
  targetPosition = {start: valueStart, end: valueEnd};
  if (rangeUtil(targetPosition, position)) {
    return {
      ...targetPosition,
      attribute,
      target: 'attributeValue',
      substr: attribute.value.substr(0, position.character - valueStart.character)
    };
  }
}

function getTagEntity(position: Position, tag: Tag): DocumentEntity {
  const {attributes, openStart, openEnd, name, closeStart, closeEnd} = tag;
  let info;
  // Determine if we're targeting an attribute name or attribute value
  for (let i = 0; i < attributes.length; i++) {
    info = hitTestAttribute(position, attributes[i]);
    if (info) {
      info.tag = tag;
      return info;
    }
  }
  // Determine if we over whitespace in the open tag
  let start = {...openStart, character: openStart.character + name.length + 2};
  let targetPosition = {start, end: openEnd};
  if (rangeUtil(targetPosition, position) && name) {
    targetPosition.start.character = openStart.character + 1;
    return {
      ...targetPosition,
      tag,
      attribute: {} as Attribute,
      target: 'attributeName',
      substr: ''
    }
  }
  // Determine if we're over the open tag's name
  let end = {...openStart, character: openStart.character + name.length + 1};
  targetPosition = {start: openStart, end};
  if (rangeUtil(targetPosition, position)) {
    targetPosition.end.character = openEnd.character++;
    targetPosition.start.character++;
    return {
      ...targetPosition,
      tag,
      target: 'tag',
      substr: tag.name.substr(0, position.character - openStart.character),
    };
  }
  // Determine if we're over whitespace in the child nodes area
  // Determine if we're over the close tag's name
  targetPosition = {start: closeStart, end: closeEnd};
  if (rangeUtil(targetPosition, position)) {
    return {
      ...targetPosition,
      tag,
      target: 'tag',
      substr: tag.name.substr(0, position.character - closeStart.character)
    };
  }
}
