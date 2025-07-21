// app/page.tsx
'use client'; // Garde ceci si tes composants internes (HeaderSlider, etc.) sont des Client Components

import React from "react"; // Importe React pour le JSX
import HeaderSlider from "@/components/HeaderSlider";
import HomeProducts from "@/components/HomeProducts";
import Banner from "@/components/Banner";
// import NewsLetter from "@/components/NewsLetter"; // Commenté, à toi de voir si tu l'utilises
import FeaturedProduct from "@/components/FeaturedProduct";
// import Navbar from "@/components/Navbar"; // <-- SUPPRIME CETTE LIGNE
import Footer from "@/components/Footer";

/**
 * Composant de la page d'accueil.
 * C'est un composant fonctionnel React qui ne prend pas de props.
 * @returns {JSX.Element} Le JSX de la page d'accueil.
 */
const Home = (): React.ReactElement => { // Type le composant comme retournant un React.ReactElement
  return (
    <>
      {/* <Navbar />  <-- SUPPRIME CETTE LIGNE */}
      <div className="px-6 md:px-16 lg:px-32">
        <HeaderSlider />
        <HomeProducts />
        <FeaturedProduct />
        <Banner />
      </div>
      <div>
        <Footer />
      </div>
    </>
  );
};

export default Home;
