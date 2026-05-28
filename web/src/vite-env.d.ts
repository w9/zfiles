/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_BOOT_MODE?: "local" | "cloud";
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
