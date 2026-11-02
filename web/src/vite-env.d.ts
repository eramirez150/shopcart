/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_APP?: 'tienda' | 'admin';
  readonly VITE_MODO_DEMO?: string;
}
