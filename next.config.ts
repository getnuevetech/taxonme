import type { NextConfig } from "next";

/**
 * Docker / low-RAM hosts (2GB VPS):
 * - DOCKER_BUILD=1 skips the post-compile TypeScript check (tsc peaks ~1GB+).
 * - experimental.cpus / webpack.parallelism keep compile single-threaded.
 * - webpackMemoryOptimizations + staticGenerationMaxConcurrency:1 reduce peak RSS
 *   during "Collecting page data" (common SIGKILL point after compile succeeds).
 * - Larger serverExternalPackages list keeps heavy deps out of the server bundle.
 * Host still needs swap or ≥2.5GB free RAM — see scripts/docker-build.sh.
 */
const isDockerBuild = process.env.DOCKER_BUILD === "1";

const nextConfig: NextConfig = {
  ...(isDockerBuild
    ? {
        typescript: {
          ignoreBuildErrors: true,
        },
      }
    : {}),
  experimental: {
    cpus: 1,
    webpackMemoryOptimizations: true,
    // One page at a time during "Collecting page data" / static generation.
    staticGenerationMaxConcurrency: 1,
  },
  // Keep heavy packages out of the webpack server graph (smaller peak RAM).
  serverExternalPackages: [
    "@prisma/client",
    "prisma",
    "bcryptjs",
    "pdf-lib",
    "pdf-parse",
    "pdfjs-dist",
    "nodemailer",
    "openai",
    "stripe",
    "zod",
  ],
  webpack: (config, { isServer }) => {
    config.parallelism = 1;
    if (isServer) {
      config.externals = config.externals || [];
    }
    return config;
  },
};

export default nextConfig;
