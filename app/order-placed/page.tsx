// app/order-placed/page.tsx
'use client';
import React, { useEffect } from 'react';
import { assets } from '@/assets/assets'; // Importe l'objet 'assets' qui doit maintenant contenir des StaticImageData
import { useAppContext } from '@/context/AppContext';
import Image from 'next/image';
import { StaticImageData } from 'next/image'; // Typage pour les images importées par Next.js

/**
 * Composant de la page de confirmation de commande.
 * Affiche un message de succès et redirige l'utilisateur vers la page "Mes Commandes" après un délai.
 * @returns {React.ReactElement} Le JSX de la page de confirmation de commande.
 */
const OrderPlaced = (): React.ReactElement => {
    // Destructuration de 'router' depuis le contexte de l'application.
    const { router } = useAppContext();

    useEffect(() => {
        // Définit le délai de redirection en millisecondes.
        const REDIRECT_DELAY_MS = 5000; // 5 secondes

        // Configure un minuteur pour rediriger l'utilisateur.
        const timer = setTimeout(() => {
            // Utilise 'router.replace' pour remplacer l'entrée actuelle de l'historique du navigateur.
            // Cela empêche l'utilisateur de revenir sur cette page de confirmation avec le bouton "précédent".
            router.replace('/my-orders');
        }, REDIRECT_DELAY_MS);

        // Fonction de nettoyage exécutée lorsque le composant est démonté ou que les dépendances changent.
        // Cela évite les fuites de mémoire si l'utilisateur quitte la page avant la redirection.
        return () => clearTimeout(timer);
    }, [router]); // Le tableau de dépendances inclut 'router' pour s'assurer que l'effet réagit si 'router' change (bonne pratique).

    // Assigner l'image 'checkmark' de l'objet 'assets'.
    // Grâce à la modification précédente de 'assets.ts', 'assets.checkmark' sera maintenant de type StaticImageData.
    const checkmarkImage: StaticImageData = assets.checkmark;

    return (
        <div className='min-h-screen flex flex-col justify-center items-center gap-8 bg-gradient-to-br from-white to-blue-50 p-4'>
            <div className="flex justify-center items-center relative">
                {/* Cercle d'animation visuel pour indiquer le chargement ou le processus */}
                <div
                    className="animate-spin rounded-full h-24 w-24 border-4 border-t-blue-500 border-gray-200"
                    role="status" // Indique aux technologies d'assistance qu'il s'agit d'un indicateur de statut
                    aria-live="polite" // Annonce les mises à jour poliment aux lecteurs d'écran
                    aria-label="Confirmation de commande en cours" // Fournit une description pour l'accessibilité
                >
                    {/* Texte visible uniquement par les lecteurs d'écran */}
                    <span className="sr-only">Confirmation de commande en cours...</span>
                </div>
                {/* Image du coche de validation, superposée au centre de l'animation */}
                <Image
                    className="absolute p-5"
                    src={checkmarkImage}
                    alt="Coche de validation - Commande réussie"
                    width={96} // Définit la largeur de l'image
                    height={96} // Définit la hauteur de l'image
                    priority // Indique à Next.js de charger cette image avec une haute priorité
                />
            </div>
            {/* Message principal de confirmation */}
            <div className="text-center text-3xl font-bold text-gray-800 animate-fade-in-up">
                Commande passée avec succès !
            </div>
            {/* Message informatif sur la redirection */}
            <p className="text-gray-600 text-lg text-center mt-2">
                Vous allez être redirigé vers l&apos;historique de vos commandes dans quelques instants.
            </p>
        </div>
    );
};

export default OrderPlaced;