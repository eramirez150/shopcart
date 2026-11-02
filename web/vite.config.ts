import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

// Un proyecto y dos compilaciones: VITE_APP=admin (o --mode admin) arma el panel y si no, la tienda.
// En desarrollo, /api se reenvía a la API de cada una: el navegador ve un solo origen y no necesita CORS.
// API_PROXY cambia el destino (se lee del entorno o de web/.env).
export default defineConfig(({ mode }) => {
  const entorno = loadEnv(mode, '.', '');
  const admin = mode === 'admin' || entorno.VITE_APP === 'admin';
  const destinoApi = entorno.API_PROXY || (admin ? 'http://localhost:3001' : 'http://localhost:3000');
  const servidor = { port: admin ? 5174 : 5173, strictPort: true, proxy: { '/api': destinoApi } };
  return {
    plugins: [react()],
    define: { 'import.meta.env.VITE_APP': JSON.stringify(admin ? 'admin' : 'tienda') },
    server: servidor,
    preview: servidor,
  };
});
