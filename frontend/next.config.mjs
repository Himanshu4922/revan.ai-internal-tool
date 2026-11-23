/** @type {import('next').NextConfig} */
const apiInternal = process.env.API_INTERNAL_URL || "http://localhost:8095";

const nextConfig = {
  output: "standalone",
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${apiInternal}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
