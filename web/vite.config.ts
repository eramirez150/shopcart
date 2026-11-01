import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

// En desarrollo, /api se reenvía a la API local: el navegador ve un solo origen y no necesita CORS.
// API_PROXY cambia el destino (se lee del entorno o de web/.env).
export default defineConfig(({ mode }) => {
  const destinoApi = loadEnv(mode, '.', '').API_PROXY || 'http://localhost:3000';
  return {
    plugins: [react()],
    server: { port: 5173, proxy: { '/api': destinoApi } },
    preview: { port: 8080, proxy: { '/api': destinoApi } },
  };
});
