import * as babel from '@babel/core';
import *  as plugin from 'babel-plugin-jsx-adaptive-cards';

export const defaultConfig = {
  code: false,
  plugins: [plugin, '@babel/plugin-syntax-jsx'],
  presets: ['@babel/preset-env']
};

export function acxReporter(code: string, config = defaultConfig): string | null {
  return babel.transform(code, config);
}
