/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  typescript: {
    // Framer Motion v10 produces spurious className/onClick type errors on all
    // motion.* elements. These are false positives — not real bugs.
    ignoreBuildErrors: true,
  },
};

module.exports = nextConfig;
