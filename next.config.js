/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    // La configuration 'domains' est dépréciée.
    // Veuillez utiliser 'remotePatterns' à la place, comme vous l'avez déjà fait ci-dessous.
    // domains: ['localhost'], // <-- Cette ligne est dépréciée et peut être supprimée

    remotePatterns: [
      {
        protocol: 'http', // or 'https'
        hostname: 'localhost',
        port: '8000', // Adjust to your backend port
        pathname: '/uploads/**', // Ensure this matches your path
      },
      // Add other remote image sources if needed
    ],
  },
  // Other Next.js configurations...
};

module.exports = nextConfig;
