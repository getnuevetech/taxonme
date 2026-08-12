import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdf-parse (pdfjs-dist) must run as a real Node dependency — bundling it
  // breaks its worker/DOM handling and silently kills PDF text extraction.
  serverExternalPackages: ["pdf-parse", "pdfjs-dist"],
  experimental: {
    serverActions: {
      // Document/photo uploads (intake, vault, notices, consultant credentials,
      // ticket attachments) flow through server actions; the framework default
      // of 1 MB rejects any real-world PDF or phone photo.
      bodySizeLimit: "64mb",
    },
  },
};

export default nextConfig;
