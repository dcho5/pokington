/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  transpilePackages: ["@pokington/engine", "@pokington/network", "@pokington/shared"],
}

module.exports = nextConfig;
