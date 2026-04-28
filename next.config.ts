import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    "*.replit.dev",
    "*.repl.co",
    "*.janeway.replit.dev",
    "*.kirk.replit.dev",
    "*.picard.replit.dev",
    "*.riker.replit.dev",
    "*.spock.replit.dev",
    "*.worf.replit.dev",
  ],
};

export default nextConfig;
