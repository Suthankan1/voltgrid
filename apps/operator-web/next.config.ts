import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER, PHASE_PRODUCTION_SERVER } from "next/constants.js";
import { readOidcConfig } from "./src/lib/oidc-config.mjs";

export default function nextConfig(phase: string): NextConfig {
  if (phase === PHASE_DEVELOPMENT_SERVER || phase === PHASE_PRODUCTION_SERVER) {
    readOidcConfig();
  }
  return {
    logging: { incomingRequests: { ignore: [/\/api\/auth\/callback/] } },
  };
}
