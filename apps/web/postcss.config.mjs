// S2-E: named const before default export (import/no-anonymous-default-export,
// surfaced by the ESLint CLI migration - `next lint` never scanned this file).
const config = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};

export default config;
