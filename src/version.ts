/**
 * Injected by esbuild from package.json at build time, so the CLI's `--version`, the SARIF
 * tool version, and the published package can never drift apart. The fallback only applies
 * when running from source (vitest, tsx), where there is no build step to do the injecting.
 */
declare const __NOBBLE_VERSION__: string | undefined;

export const VERSION: string =
  typeof __NOBBLE_VERSION__ === 'string' ? __NOBBLE_VERSION__ : '0.0.0-dev';
