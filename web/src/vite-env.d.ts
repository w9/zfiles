/// <reference types="vite/client" />

declare const __ZFILES_VERSION__: string;

interface ImportMetaEnv {
  readonly VITE_BOOT_MODE?: "local" | "cloud";
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
