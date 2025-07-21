// C:\xampp\htdocs\02_PlawimAdd_TS\components\Banner.tsx
"use client"; // Ce composant utilise des hooks React (motion de Framer Motion)

import React from "react"; // Il est bon d'importer React pour les types JSX
import { assets } from "@/assets/assets"; // Assurez-vous que ce chemin est correct et que assets est typé
import Image from "next/image"; // Next.js Image component
import { motion } from "framer-motion"; // Framer Motion for animations

const Banner = () => {
  return (
    <div className="flex flex-col md:flex-row items-center justify-between md:pl-20 py-14 md:py-0 bg-zinc-100 my-16 rounded-xl overflow-hidden relative">
      {/* Animation pour l'image de gauche (oscillation continue) */}
      <motion.div
        initial={{ x: -100, opacity: 0 }}
        whileInView={{ x: 0, opacity: 1 }}
        animate={{
          x: 0,
          y: [0, -5, 0], // Ajout des types pour 'y' dans l'animation (non obligatoire ici car inféré, mais bonne pratique)
        }}
        transition={{
          duration: 0.8,
          ease: "easeOut",
          delay: 0.2,
          y: {
            duration: 3,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 0.5,
          },
        }}
        viewport={{ once: true, amount: 0.5 }}
      >
        <Image
          className="max-w-[224px]"
          src={assets.banner_bg1_image} // assets est maintenant typé grâce à assets.ts
          alt="image_boîte_son_jbl"
          width={224}
          height={224}
          priority
        />
      </motion.div>

      {/* Contenu central (garde l'animation d'apparition et pulsation du bouton) */}
      <motion.div
        initial={{ y: 50, opacity: 0 }}
        whileInView={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.8, delay: 0.3, ease: "easeOut" }}
        viewport={{ once: true, amount: 0.5 }}
        className="flex flex-col items-center justify-center text-center space-y-2 px-4 md:px-0 z-10 flex-grow"
      >
        <h2 className="text-2xl md:text-3xl text-zinc-950 font-semibold max-w-[290px]">
          Un Étudiant, un Ordinateur Portable
        </h2>
        <p className="max-w-[343px] font-medium text-zinc-800/60">
          Mise à disposition d&apos;ordinateurs portables modernes, puissants et
          adaptés aux défis technologiques actuels, le tout à un prix
          forfaitaire flexible.
        </p>
        <motion.a
          href="/offer"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          animate={{ scale: [1, 1.02, 1] }}
          transition={{
            duration: 1.5,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 1,
          }}
          className="group flex items-center justify-center gap-1 px-12 py-2.5 bg-blue-600 hover:bg-blue-800 rounded text-zinc-50 cursor-pointer"
        >
          En savoir plus
        </motion.a>
      </motion.div>

      {/* Animation pour l'image de droite (oscillation continue) */}
      <motion.div
        initial={{ x: 100, opacity: 0 }}
        whileInView={{ x: 0, opacity: 1 }}
        animate={{
          x: 0,
          y: [0, 5, 0], // Ajout des types pour 'y' dans l'animation (non obligatoire ici car inféré, mais bonne pratique)
        }}
        transition={{
          duration: 0.8,
          ease: "easeOut",
          delay: 0.4,
          y: {
            duration: 3,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 0.7,
          },
        }}
        viewport={{ once: true, amount: 0.5 }}
        className="hidden md:block"
      >
        <Image
          className="max-w-[320px]"
          src={assets.banner_bg2_image} // assets est maintenant typé grâce à assets.ts
          alt="image_manette_moyenne"
          width={320}
          height={320}
          priority
        />
      </motion.div>
    </div>
  );
};

export default Banner;