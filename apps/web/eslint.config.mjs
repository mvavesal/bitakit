import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTypeScript from 'eslint-config-next/typescript';

export default defineConfig([
  ...nextVitals,
  ...nextTypeScript,
  globalIgnores([
    '.foundation/**',
    '.next/**',
    'next-env.d.ts',
    'zenstack/schema.ts',
    'zenstack/input.ts',
    'zenstack/models.ts',
  ]),
]);
