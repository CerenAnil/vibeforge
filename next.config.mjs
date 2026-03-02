/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    typedRoutes: true
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.scdn.co" },
      { protocol: "https", hostname: "i.scdn.co" }
    ]
  }
};

export default nextConfig;
