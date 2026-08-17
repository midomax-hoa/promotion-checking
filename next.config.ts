import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Standalone output keeps the Docker image small (phase 08).
  output: 'standalone',
}

export default nextConfig
