// S2-E: ESLint CLI migration (next lint is deprecated, removed in Next 16).
// Flat config via FlatCompat, exactly the create-next-app@15 scaffold — same
// next/core-web-vitals ruleset as the old .eslintrc.json. Two additions the
// ESLint CLI needs and `next lint` did silently: global ignores for the build
// output (.next), and full-project scope (next lint only scanned source dirs,
// so config files like postcss.config.mjs are now covered too).
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { FlatCompat } from '@eslint/eslintrc';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  { ignores: ['.next/**', 'out/**', 'build/**', 'next-env.d.ts'] },
  ...compat.extends('next/core-web-vitals'),
];

export default eslintConfig;
