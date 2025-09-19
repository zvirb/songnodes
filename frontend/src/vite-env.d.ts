/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string
  readonly VITE_VISUALIZATION_API_URL: string
  readonly VITE_WS_URL: string
  readonly VITE_ENV: string
  readonly VITE_DEBUG: string
  readonly VITE_ENABLE_MOCK_DATA: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}