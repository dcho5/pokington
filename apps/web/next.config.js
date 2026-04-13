/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  transpilePackages: ["@pokington/engine", "@pokington/shared"],
}

module.exports = nextConfig;
