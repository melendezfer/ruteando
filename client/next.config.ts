import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // El repo tiene dos package-lock.json (raíz para el backend, client/
  // para este proyecto) — sin esto, Turbopack infiere mal la raíz del
  // workspace (toma la del repo, no la de client/) y lo advierte en cada
  // arranque de `next dev`.
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;
