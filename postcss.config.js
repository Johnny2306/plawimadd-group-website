// C:\xampp\htdocs\plawimadd_group\postcss.config.js

/** @type {import('postcss-load-config').Config} */
const config = {
  plugins: {
    'postcss-import': {}, // Pour gérer les @import dans votre CSS
    'postcss-nesting': {}, // Pour le nesting CSS (ex: &::before)
    tailwindcss: {}, // Le plugin principal de Tailwind CSS
    autoprefixer: {}, // Pour ajouter les préfixes vendeurs automatiquement
  },
};

module.exports = config; // <-- CORRECTION ICI : Utilisez module.exports pour les fichiers .js
