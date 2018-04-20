const babel = require('@babel/core');
const plugin = require('babel-plugin-jsx-adaptive-cards');

const defaultConfig = {
  code: false,
  plugins: [plugin, '@babel/plugin-syntax-jsx'],
  presets: ['@babel/preset-env']
};

function acxReporter(code, config = defaultConfig) {
  return babel.transform(code, config);
}

module.exports = {acxReporter, defaultConfig};
