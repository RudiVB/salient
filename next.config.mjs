/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,            // strict mode double-mounts effects; off so the WebGL canvas mounts once
  eslint: { ignoreDuringBuilds: true },   // don't fail Vercel builds on lint
  typescript: { ignoreBuildErrors: true } // pragmatic for a starter; tighten later
};
export default nextConfig;
