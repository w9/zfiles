declare const __ZFILES_VERSION__: string | undefined;

export const APP_VERSION =
  typeof __ZFILES_VERSION__ === "string" ? __ZFILES_VERSION__ : "0.0.0-dev";
