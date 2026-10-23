/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_WS_URL?: string;
  readonly VITE_SPOTIFY_CLIENT_ID?: string;
  readonly VITE_TIDAL_CLIENT_ID?: string;
  readonly VITE_PROMETHEUS_URL?: string;
  // Visibility gate only; keep off until milestone-6 routing is validated.
  readonly VITE_ENABLE_WAVE_ROUTING?: string;
  // Add more env variables as needed
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
