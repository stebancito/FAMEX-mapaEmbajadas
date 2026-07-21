import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  base: '/famex-mapaembajadas/', 
  build: {
    outDir: 'dist',
  },
  plugins: [
    tailwindcss(),
  ],
});