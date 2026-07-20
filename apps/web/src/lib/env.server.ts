import "server-only";
import { loadServerEnv, type ServerEnv } from "@mboyo/domain";

let cached: ServerEnv | undefined;

/**
 * Lazily validates and returns the server-side environment. Deliberately not
 * evaluated at module load time so `next build` (which has no real secrets
 * available, e.g. in CI) does not fail just from importing this module —
 * call this only from the request/handler code path that actually needs it.
 */
export function getServerEnv(): ServerEnv {
  cached ??= loadServerEnv(process.env);
  return cached;
}
