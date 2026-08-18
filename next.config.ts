import type { NextConfig } from 'next'

/**
 * Origins allowed to submit a Server Action.
 *
 * Behind a reverse proxy the browser sends `Origin: promotion.example.com`
 * while the container sees `Host: app:3000`. Next.js 15 compares the two and
 * rejects the mismatch with `Invalid Server Actions request`, so the public
 * domain has to be declared explicitly.
 *
 * Read from the environment rather than hard-coded: the same image has to run
 * against whatever domain the deployment was given. `ALLOWED_ORIGINS` is passed
 * both as a build argument and at run time, because the standalone build bakes
 * this config into `server.js`.
 */
function allowedOrigins(): string[] {
  return (process.env.ALLOWED_ORIGINS ?? 'localhost:3000')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
}

const nextConfig: NextConfig = {
  // Standalone output keeps the Docker image small (phase 08).
  output: 'standalone',
  experimental: {
    serverActions: {
      // Headroom over the 20 MB upload cap in `upload-limits.ts`: multipart
      // framing adds to the body, and the cap is enforced in the route handler.
      bodySizeLimit: '25mb',
      allowedOrigins: allowedOrigins(),
    },
  },
}

export default nextConfig
