
import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
    ],
  },
  devIndicators: {
    allowedDevOrigins: [
      '*.cluster-ikxjzjhlifcwuroomfkjrx437g.cloudworkstations.dev',
    ],
  },
  experimental: {
    outputFileTracingIncludes: {
      '/*': ['./data/**/*'],
    },
  },
};

export default nextConfig;
