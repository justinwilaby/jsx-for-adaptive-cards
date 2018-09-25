import {
  CompletionItem,
  CompletionItemKind,
  CompletionParams,
  InsertTextFormat,
  Position,
  TextDocumentContentChangeEvent,
  TextEdit
} from 'vscode-languageserver-protocol';
import {findElementChildProperty} from 'babel-plugin-jsx-adaptive-cards/lib/helpers';
import {definitionsMap} from 'babel-plugin-jsx-adaptive-cards/lib/utils';

import {DocumentEntity, findEntityAtPosition} from '../../utils/findEntityAtPosition';
import {getDefinitionFromSchema, getValueFromSchema} from '../../utils/schemaUtil';
import definitionToTagName from './definitionToTagName';
import typeToAttributeValue from './typeToAttributeValue';
import {Attribute} from 'sax-wasm/lib';

const definitions = getValueFromSchema('#/definitions');

export async function getCompletionList(completionParams: CompletionParams, document: TextDocumentContentChangeEvent): Promise<CompletionItem | CompletionItem[]> {
  const {position} = completionParams;
  const entity = await findEntityAtPosition(position, document.text);
  const {target} = entity;
  let list: CompletionItem | CompletionItem[];
  switch (target) {
    case 'tag':
      list = getTagsCompletionList(entity);
      break;

    case 'attributeValue':
      list = getAttributeValueCompletionList(entity);
      break;

    case 'attributeName':
      list = getAttributeCompletionList(entity, position);
      break;
  }
  return list;
}

function getTagsCompletionList(entity: DocumentEntity): CompletionItem[] {
  const {parent = {name: '', attributes: []}, substr = ''} = entity;
  const {name: parentName, attributes = []} = parent;
  const matches: { [label: string]: CompletionItem } = {};
  let targetRefs = [];
  // If not parent exists, allow any tag from the definitions
  const typeAttribute = attributes.find(attr => attr.name === 'type') || {value: ''};
  if (!parent.name) {
    targetRefs = Object.keys(definitions)
      .filter(definition => definitionToTagName[definition])
      .map(definition => `#/definitions/${definition}`);
  } else if (parent.name === 'body') {
    targetRefs = ['#/definitions/CardElements'];
  } else if (parent.name === 'actions') {
    targetRefs = ['#/definitions/Actions'];
  } else if (parent.name === 'card') {
    targetRefs = ['#/definitions/CardElements', '#/definitions/Actions'];
  } else if (parentName === 'action' && typeAttribute.value === 'showCard') {
    targetRefs = ['#/definitions/AdaptiveCard']
  } else {
    // This gets tricky since some elements have implicit
    // child properties that need to be known. If a child property
    // doesn't have a $ref, no completion list is shown.
    let {value: type} = typeAttribute;
    if (parentName === 'action') {
      type = definitionsMap[parentName][type];
    }
    const childProperty = findElementChildProperty(parentName, type);
    const parentSchema = getDefinitionFromSchema(parentName, typeAttribute.value);
    const targetProperty = childProperty ? parentSchema.properties[childProperty] : {};
    if ('$ref' in targetProperty) {
      targetRefs = [targetProperty.$ref];
    } else if ('items' in targetProperty) {
      if ('$ref' in targetProperty.items) {
        targetRefs = [targetProperty.items.$ref];
      } else if (targetProperty.items instanceof Array) {
        // Special case - there is only one items array in this schema
        targetRefs = targetProperty.items[0].anyOf.map(anyOf => anyOf.$ref);
      }
    }
  }
  targetRefs.forEach($ref => matchRef(matches, substr, entity, $ref));
  return Object.keys(matches).map(match => matches[match]);
}

function matchRef(matches: { [label: string]: CompletionItem }, substr: string, entity: DocumentEntity, $ref: string): void {
  if (!$ref) {
    return;
  }
  const value = getValueFromSchema($ref);
  let items = 'anyOf' in value ? [value] : value.items;
  if (Array.isArray(items)) {
    items.forEach(item => {
      if (item.anyOf) {
        item.anyOf.forEach(anyOf => matchRef(matches, substr, entity, anyOf.$ref));
      }
    });
  } else if (items && '$ref' in items) {
    matchRef(matches, substr, entity, items.$ref);
  } else {
    const definitionName = $ref.split('/').pop();
    const acxTagName = definitionToTagName[definitionName];
    if (acxTagName.startsWith(substr)) {
      const {insertText, label} = buildSnippetAndLabel(acxTagName, value);
      const textEdits = buildTextEdits(entity, insertText);
      matches[label] = {
        label,
        // insertText,
        filterText: acxTagName,
        kind: CompletionItemKind.Struct,
        data: $ref,
        detail: (value.description || '').trim(),
        insertTextFormat: InsertTextFormat.Snippet,
        textEdit: textEdits.shift(),
        additionalTextEdits: textEdits
      };
    }
  }
}

function getAttributeValueCompletionList(entity: DocumentEntity): CompletionItem {
  const {tag, attribute} = entity;
  const {name: attributeName, valueStart, valueEnd} = attribute;
  const type = tag.attributes.find(attr => attr.name === 'type') || {value: ''};
  const tagSchemaDefinition = getDefinitionFromSchema(tag.name, type.value);
  const targetProperty = tagSchemaDefinition.properties[attributeName];
  let {'enum': enums, type: dataType} = targetProperty;
  if (dataType === 'boolean') {
    enums = ['true', 'false']
  }
  if (!enums) {
    return;
  }
  return enums.map(label => {
    let newText = label;
    // TODO - Determine why this is necessary
    if (dataType !== 'string') {
      newText += '}';
    }
    return {
      label,
      filterText: label,
      kind: CompletionItemKind.Value,
      insertTextFormat: InsertTextFormat.PlainText,
      textEdit: {
        newText,
        range: {start: valueStart, end: valueEnd}
      }
    };
  });
}

function getAttributeCompletionList(entity: DocumentEntity, position: Position): CompletionItem[] {
  const {attribute = {} as Attribute, substr, tag} = entity;
  const {nameStart = position, nameEnd = position} = attribute;
  const {name: acxTagName, attributes} = tag;
  const typeAttribute = attributes.find(attr => attr.name === 'type') || {value: null};
  let properties;
  const excludedProperties = getExcludedProperties(acxTagName);
  // changing the type attribute on an <input> or <action> tag
  if ((acxTagName === 'input' || acxTagName === 'action') && !typeAttribute.value) {
    const defMap = {...definitionsMap[acxTagName]};
    delete defMap.childFieldName;
    const defs = Object.keys(defMap).map(key => getDefinitionFromSchema(acxTagName, key));
    const enums = defs.map(def => typeToAttributeValue[def.properties.type.enum[0]]);
    properties = {type: {['enum']: enums, description: `The type of ${acxTagName}`, type: 'string'}};
    delete excludedProperties.type;
  } else {
    properties = getDefinitionFromSchema(acxTagName, typeAttribute.value).properties;
  }

  const completionItems: CompletionItem[] = [];

  Object.keys(properties).forEach(property => {
    const {description = '', 'enum': enums = [], type} = properties[property];
    if (type === 'boolean') {
      enums.push('true', 'false');
    }
    enums.sort();
    if (!excludedProperties[property] &&
      !attributes.some(attr => attr.name === property) &&
      property.startsWith(substr)) {

      let newText = `${property}=`;
      if (type === 'string') {
        newText += enums.length ? `"\${1|${enums.toString()}|}"` : `"$1"`;
      } else {
        newText += enums.length ? `{\${1|${enums.toString()}|}}` : '{$1}';
      }

      const completionItem: CompletionItem = {
        label: property,
        // insertText,
        filterText: acxTagName,
        kind: CompletionItemKind.Property,
        detail: description.trim(),
        insertTextFormat: InsertTextFormat.Snippet,
        textEdit: {
          newText,
          range: {start: nameStart, end: nameEnd}
        }
      };

      completionItems.push(completionItem);
    }
  });
  return completionItems;
}

function buildTextEdits(entity: DocumentEntity, insertText: string): TextEdit[] {
  const {tag} = entity;
  const {openStart, openEnd, closeStart = openStart, closeEnd = openEnd, selfClosing, name} = tag;
  const textEdits = [];
  // Text edit should only include the first
  // and last lines of the tag
  const isMultiLineNode = !!name && !selfClosing && closeEnd.line > openStart.line;
  const insertTextLines = insertText.split('\n');

  let end = isMultiLineNode ? openEnd : closeEnd;
  let start = openStart;

  let newText = isMultiLineNode ? insertTextLines.shift() : insertText;
  let textEdit: TextEdit = {range: {start, end}, newText};
  textEdits.push(textEdit);

  if (isMultiLineNode) {
    start = {line: closeStart.line, character: closeStart.character - 1};
    end = closeEnd;

    textEdit = {range: {start, end}, newText: insertTextLines.pop()};
    textEdits.push(textEdit);
  }

  return textEdits;
}

function buildSnippetAndLabel(acxTagName: string, schemaValue: any): CompletionItem {
  const excludedProperties = getExcludedProperties(acxTagName);
  let isSelfClose = !findElementChildProperty(acxTagName);
  let insertText = `${acxTagName}`;
  let label = `<${acxTagName}>`;

  if (acxTagName === 'card') {
    isSelfClose = false;
    insertText = 'card>\n  <body>\n   $1 \n  </body>\n  <actions>\n   $2 \n  </actions>\n</card>';
    return {insertText, label};
  }

  const attrs = Object.keys((schemaValue.properties || {}))
    .filter(propName => !excludedProperties[propName])
    .sort((a, b) => {
      if (a === 'type' || b === 'type') {
        return 1;
      }
      if (a < b) {
        return -1;
      }
      if (a > b) {
        return 1;
      }
      return 0;
    });

  attrs.forEach((attr, index) => {
    let {[attr]: property} = schemaValue.properties;
    if ('$ref' in property) {
      property = getValueFromSchema(property.$ref);
    }
    const {type, 'enum': enums = []} = property;
    enums.sort();
    if (type === 'boolean') {
      enums.push('true', 'false');
    }
    if (attr === 'type' && /^(input|action)$/.test(acxTagName)) {
      const [enumValue] = schemaValue.properties.type.enum;
      const acxTypeValue = typeToAttributeValue[enumValue];
      isSelfClose = !findElementChildProperty(acxTagName, enumValue);
      label = `<${acxTagName} type="${acxTypeValue}">`;
      insertText += ` type="${acxTypeValue}"`;
    } else {
      insertText += ` ${attr}=`;
      if (type !== 'string') {
        insertText += enums.length ? `{\${${++index}|${enums.toString()}|}}` : `{$${++index}}`;
      } else {
        insertText += enums.length ? `"\${${++index}|${enums.toString()}|}"` : `"$${++index}"`;
      }
    }
  });
  insertText += isSelfClose ? '/>' : `>\n  \n</${acxTagName}>`;
  return {insertText, label};
}

function getExcludedProperties(acxTagName: string): { [propName: string]: boolean } {
  const excludedProperties = {
    items: true,
    columns: true,
    selectAction: true,
    body: true,
    actions: true,
    facts: true,
    text: true,
    images: true,
    data: true,
    card: true,
    choices: true,
    type: false
  };
  // Types are implicit for all elements except these
  if (!/^(input|action)$/.test(acxTagName)) {
    excludedProperties.type = true;
  }
  return excludedProperties;
}
