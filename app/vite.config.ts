import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    target: 'es2022',
    sourcemap: false,
    // The polyfill adds a fetch() of preload hrefs; every supported browser has native
    // modulepreload, and the privacy gate allows no fetch( outside the data loader.
    modulePreload: { polyfill: false },
  },
});
