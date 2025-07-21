    // C:\xampp\htdocs\plawimadd_group\postcss.config.js (ou .mjs)

    /** @type {import('postcss-load-config').Config} */
    const config = {
      plugins: {
        'postcss-import': {}, // Pour gérer les @import dans votre CSS
        'postcss-nesting': {}, // Pour le nesting CSS (ex: &::before)
        tailwindcss: {}, // Le plugin principal de Tailwind CSS
        autoprefixer: {}, // Pour ajouter les préfixes vendeurs automatiquement
      },
    };

    export default config; // Si c'est un fichier .mjs
    