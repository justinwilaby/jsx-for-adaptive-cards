const {CompletionItemKind, InsertTextFormat} = require('vscode-languageserver-protocol');
const {findElementChildProperty} = require('babel-plugin-jsx-adaptive-cards/lib/helpers');
const {definitionsMap} = require('babel-plugin-jsx-adaptive-cards/lib/utils');

const {findEntityAtPosition} = require('../../utils/findEntityAtPosition');
const {getValueFromSchema, getDefinitionFromSchema} = require('../../utils/schemaUtil');
const definitionToTagName = require('./definitionToTagName');
const typeToAttributeValue = require('./typeToAttributeValue');

const definitions = getValueFromSchema('#/definitions');

async function getCompletionList(completionParams, document) {
  const {position} = completionParams;
  const entity = await findEntityAtPosition(position, document.text);
  const {target} = entity;
  let list;
  switch (target) {
    case 'tag':
      list = getTagsCompletionList(entity, position);
      break;

    case 'attributeValue':
      list = getAttributeValueCompletionList(entity, position);
      break;

    case 'attribute':
      list = getAttributeCompletionList(entity, position);
      break;
  }
  return list;
}

function getTagsCompletionList(entity) {
  const {parent = {attributes: {}}, substr = '',} = entity;
  const {name: parentName, attributes} = parent;
  const matches = {};
  let targetRefs = [];
  // If not parent exists, allow any tag from the definitions
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
  } else if (parentName === 'action' && attributes.type === 'showCard') {
    targetRefs = ['#/definitions/AdaptiveCard']
  } else {
    // This gets tricky since some elements have implicit
    // child properties that need to be known. If a child property
    // doesn't have a $ref, no completion list is shown.
    let {type} = attributes;
    if (parentName === 'action') {
      type = definitionsMap[parentName][type];
    }
    const childProperty = findElementChildProperty(parentName, type);
    const parentSchema = getDefinitionFromSchema(parentName, attributes.type);
    const targetProperty = childProperty ? parentSchema.properties[childProperty] : {};
    if ('$ref' in targetProperty) {
      targetRefs = [targetProperty.$ref];
    } else if ('items' in targetProperty && '$ref' in targetProperty.items) {
      targetRefs = [targetProperty.items.$ref];
    }
  }
  targetRefs.forEach($ref => matchRef(matches, substr, entity, $ref));
  return Object.keys(matches).map(match => matches[match]);
}

function getAttributeValueCompletionList(entity) {
  const {tag, attributeName, attributeValueStart, attributeValueEnd} = entity;
  const {type} = tag.attributes;
  const tagSchemaDefinition = getDefinitionFromSchema(tag.name, type);
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
        range: {start: attributeValueStart, end: attributeValueEnd}
      }
    };
  });
}

function getAttributeCompletionList(entity, position) {
  const {attributeStart = position, attributeEnd = position, substr} = entity;
  const {attributes, name: acxTagName} = entity.tag;
  const {type} = attributes;
  const {properties} = getDefinitionFromSchema(acxTagName, type);

  const excludedProperties = getExcludedProperties(acxTagName);
  const completionItems = [];

  Object.keys(properties).forEach(property => {
    const {description = '', 'enum': enums = [], type} = properties[property];
    if (type === 'boolean') {
      enums.push('true', 'false');
    }
    enums.sort();
    if (!excludedProperties[property] &&
      !attributes[property] &&
      property.startsWith(substr)) {

      let newText = `${property}=`;
      if (type === 'string') {
        newText += enums.length ? `"\${1|${enums.toString()}|}"` : `"$1"`;
      } else {
        newText += enums.length ? `{\${1|${enums.toString()}|}}` : '{$1}';
      }

      const completionItem = {
        label: property,
        // insertText,
        filterText: acxTagName,
        kind: CompletionItemKind.Property,
        detail: description.trim(),
        insertTextFormat: InsertTextFormat.Snippet,
        textEdit: {
          newText,
          range: {start: attributeStart, end: attributeEnd}
        }
      };

      completionItems.push(completionItem);
    }
  });
  return completionItems;
}

function matchRef(matches, substr, entity, $ref) {
  if (!$ref) {
    return;
  }
  const value = getValueFromSchema($ref);
  let items = 'anyOf' in value ? [value] : value.items;
  if (Array.isArray(items)) {
    items.forEach(item => {
      if (item.anyOf) {
        item.anyOf.forEach(item => matchRef(matches, substr, entity, item.$ref));
      }
    });
  } else if (items && '$ref' in items) {
    matchRef(matches, substr, entity, items.$ref);
  } else {
    const definitionName = $ref.split('/').pop();
    const acxTagName = definitionToTagName[definitionName];
    if (acxTagName.startsWith(substr)) {
      const {insertText, label} = buildSnippetAndLabel(acxTagName, value, entity);
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

function buildTextEdits(entity, insertText) {
  const {tag} = entity;
  const {openTagStart, openTagEnd, closeTagStart = openTagStart, closeTagEnd = openTagEnd, isSelfClosing, name} = tag;
  const {line: openTagLine} = openTagStart;
  const {line: closeTagLine = openTagLine} = closeTagEnd;
  const lines = closeTagLine - openTagLine;
  const textEdits = [];
  // Text edit should only include the first
  // and last lines of the tag
  const isMultiLineNode = !!name && !isSelfClosing && closeTagEnd.line > openTagStart.line;
  const insertTextLines = insertText.split('\n');

  let end = isMultiLineNode ? openTagEnd : closeTagEnd;
  let start = openTagStart;

  let line = isMultiLineNode ? insertTextLines.shift() : insertText;
  let textEdit = {range: {start, end}};
  textEdit.newText = line;
  textEdits.push(textEdit);

  if (isMultiLineNode) {
    start = {line: closeTagStart.line, character: closeTagStart.character - 1};
    end = closeTagEnd;

    textEdit = {range: {start, end}};
    textEdit.newText = insertTextLines.pop();
    textEdits.push(textEdit);
  }

  return textEdits;
}

function buildSnippetAndLabel(acxTagName, schemaValue, entity) {
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

function getExcludedProperties(acxTagName) {
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
    choices: true
  };
  // Types are implicit for all elements except these
  if (!/^(input|action)$/.test(acxTagName)) {
    excludedProperties.type = true;
  }
  return excludedProperties;
}

module.exports = {getCompletionList};
