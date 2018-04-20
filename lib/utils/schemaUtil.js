const {getDefinitionFromSchema, getValueFromSchema} = require('babel-plugin-jsx-adaptive-cards/lib/helpers');

function getSchemaFragment(entity) {
  const {tag = {}} = entity;
  const {attributes = {}} = tag;
  if (/^(action|input)$/.test(tag.name) && !attributes.type) {
    return {description: `Defines an ${tag.name}. The "type" attribute is required.`};
  }
  if (/^(body|actions)$/.test(tag.name)) {
    return getValueFromSchema('#/definitions/AdaptiveCard').properties[tag.name];
  }
  try {
    return getDefinitionFromSchema({buildCodeFrameError}, tag.name, attributes.type);
  } catch (e) {
    return {};
  }
}

function getSchemaPropertyInfo(entity) {
  const {attributeName} = entity;
  const fragment = getSchemaFragment(entity);
  const {properties} = fragment;
  if (!properties) {
    return {};
  }
  let {[attributeName]: targetProperty = {}} = properties;
  if ('$ref' in targetProperty) {
    targetProperty = getValueFromSchema(targetProperty.$ref);
  }
  return targetProperty;
}

function buildCodeFrameError(message) {
  return new SyntaxError(message);
}

module.exports = {
  getSchemaFragment,
  getSchemaPropertyInfo,
  getDefinitionFromSchema: getDefinitionFromSchema.bind(null, {buildCodeFrameError}),
  getValueFromSchema
};
