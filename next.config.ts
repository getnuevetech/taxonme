import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdf-parse (pdfjs-dist) must run as a real Node dependency — bundling it
  // breaks its worker/DOM handling and silently kills PDF text extraction.
  serverExternalPackages: ["pdf-parse", "pdfjs-dist"],
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
