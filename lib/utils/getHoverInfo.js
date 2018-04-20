const {findEntityAtPosition} = require('../utils/findEntityAtPosition');
const {getSchemaFragment, getSchemaPropertyInfo} = require('../utils/schemaUtil');

async function getHoverInfo(position, document) {
  const entity = await findEntityAtPosition(position, document.text);
  const {target} = entity;

  if (!target) {
    return;
  }
  if (target === 'tag') {
    const {description: contents = ''} = getSchemaFragment(entity);
    return {contents};
  }

  if (target === 'attribute') {
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

function arrayToHumanString(array) {
  if (!Array.isArray(array)) {
    return array.toString();
  }
  const commaSeparated = array.slice(0, array.length - 1);
  return commaSeparated.join(', ').concat(` or ${array[array.length - 1]}`);
}

module.exports = {getHoverInfo};
