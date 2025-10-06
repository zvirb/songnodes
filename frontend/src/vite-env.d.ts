/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_WS_URL?: string;
  readonly VITE_SPOTIFY_CLIENT_ID?: string;
  readonly VITE_TIDAL_CLIENT_ID?: string;
  readonly VITE_PROMETHEUS_URL?: string;
  // Add more env variables as needed
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
