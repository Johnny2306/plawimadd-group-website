/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    // Supprimez toute configuration 'domains' ou 'remotePatterns' qui pointe vers 'localhost'
    // car vos images ne sont plus servies localement.
    remotePatterns: [
      {
        protocol: 'https', // Cloudinary utilise toujours HTTPS
        hostname: 'res.cloudinary.com',
        port: '',
        // TRÈS IMPORTANT : Utilisation de votre Cloud Name fourni
        pathname: '/doh6hve6o/**', // REMPLACÉ PAR VOTRE CLOUD NAME
      },
    ],
  },
};

module.exports = nextConfig;
