import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
