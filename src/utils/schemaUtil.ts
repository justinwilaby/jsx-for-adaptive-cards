import {
  getDefinitionFromSchema as defFromSchema,
  getValueFromSchema as getValFromSchema
} from 'babel-plugin-jsx-adaptive-cards/lib/helpers';
import {DocumentEntity} from './findEntityAtPosition';
import {Attribute, Tag} from 'sax-wasm/lib';

export function getSchemaFragment(entity: DocumentEntity) {
  const {tag = {} as Tag} = entity;
  const {attributes = [] as Attribute[]} = tag;
  const typeAttribute = attributes.find(attr => attr.name === 'type') || {value: ''};
  if (/^(action|input)$/.test(tag.name) && !typeAttribute.value) {
    return {description: `Defines an ${tag.name}. The "type" attribute is required.`};
  }
  if (/^(body|actions)$/.test(tag.name)) {
    return getValueFromSchema('#/definitions/AdaptiveCard').properties[tag.name];
  }
  try {
    return defFromSchema({buildCodeFrameError}, tag.name, typeAttribute.value);
  } catch {
    return {};
  }
}

export function getSchemaPropertyInfo(entity: DocumentEntity) {
  const {name} = entity.attribute;
  const fragment = getSchemaFragment(entity);
  const {properties} = fragment;
  if (!properties) {
    return {};
  }
  let {[name]: targetProperty = {}} = properties;
  if ('$ref' in targetProperty) {
    targetProperty = getValFromSchema(targetProperty.$ref);
  }
  return targetProperty;
}

function buildCodeFrameError(message) {
  return new SyntaxError(message);
}

export const getDefinitionFromSchema = defFromSchema.bind(null, {buildCodeFrameError});
export const getValueFromSchema = getValFromSchema;
