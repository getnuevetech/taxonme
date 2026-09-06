import type { NextConfig } from "next";

// Docker builds on small VPS hosts OOM during Next's post-compile TypeScript
// pass (SIGKILL after "✓ Compiled successfully"). Skip that pass when
// DOCKER_BUILD=1; CI still typechecks via `npm run typecheck` + full build.
const dockerBuild = process.env.DOCKER_BUILD === "1";

const nextConfig: NextConfig = {
  // pdf-parse (pdfjs-dist) must run as a real Node dependency — bundling it
  // breaks its worker/DOM handling and silently kills PDF text extraction.
  serverExternalPackages: ["pdf-parse", "pdfjs-dist"],
  typescript: dockerBuild
    ? { ignoreBuildErrors: true }
    : undefined,
  async redirects() {
    return [
      { source: "/updates", destination: "/irs-updates", permanent: true },
      { source: "/updates/:slug", destination: "/irs-updates/:slug", permanent: true },
      { source: "/app/updates", destination: "/app/irs-updates", permanent: true },
    ];
  },
  experimental: {
    // Cap compile workers so Docker builds on 2GB hosts are less likely to OOM.
    cpus: 1,
    serverActions: {
      // Document/photo uploads (intake, vault, notices, consultant credentials,
      // ticket attachments) flow through server actions; the framework default
      // of 1 MB rejects any real-world PDF or phone photo.
      bodySizeLimit: "64mb",
    },
  },
  webpack: (config, { dev }) => {
    if (!dev) {
      // One compile unit at a time — trades a bit of wall time for lower peak RAM.
      config.parallelism = 1;
    }
    return config;
  },
};

export default nextConfig;
