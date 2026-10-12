import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

// '@shared' apunta a la carpeta /shared de la raíz (marca Kontrola, tema, footer del desarrollador)
const shared = fileURLToPath(new URL('../shared', import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@shared': shared } },
  server: { port: 5174, strictPort: true, fs: { allow: ['..'] } },
  preview: { port: 5174 },
});
