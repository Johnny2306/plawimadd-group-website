// components/HomeProducts.tsx
'use client';

import React from 'react';
import ProductCard from './ProductCard';
import { useAppContext } from '@/context/AppContext'; // Importé pour utiliser router
import { Product } from '@/lib/types'; // Assurez-vous que l'importation est correcte

const HomeProducts = () => {
    const { 
        products, 
        loadingProducts, 
        errorProducts,
        router // Gardez router ici car il est utilisé directement dans HomeProducts
    } = useAppContext();

    if (loadingProducts) {
        return (
            <div className="flex justify-center items-center py-14">
                <p className="text-xl text-gray-600">Chargement des produits...</p>
            </div>
        );
    }

    if (errorProducts) {
        return (
            <div className="flex justify-center items-center py-14">
                <p className="text-xl text-red-600">Erreur lors du chargement des produits : {errorProducts}</p>
            </div>
        );
    }

    if (!products || products.length === 0) {
        return (
            <div className="flex justify-center items-center py-14">
                <p className="text-xl text-gray-600">Aucun produit trouvé pour le moment.</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col items-center pt-14">
            <p className="text-2xl font-medium text-left w-full">Produits populaires</p>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6 mt-6 pb-14 w-full">
                {products.map((product: Product) => (
                    <ProductCard
                        key={product.id}
                        product={product}
                        // PLUS besoin de passer addToCart, formatPrice, router ici !
                    />
                ))}
            </div>
            <button
                onClick={() => router.push('/all-products')}
                className="px-12 py-2.5 border rounded text-zinc-600 hover:bg-blue-500 hover:text-zinc-50 transition"
            >
                Voir plus
            </button>
        </div>
    );
};

export default HomeProducts;