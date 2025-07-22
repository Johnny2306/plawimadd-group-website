'use client';

import React, { ChangeEvent } from 'react';
import { useAppContext } from '@/context/AppContext';
import ProductCard from '@/components/ProductCard';
import Footer from '@/components/Footer';
import { Product as BaseProduct } from '@/lib/types';

// Étend le produit pour inclure _id si besoin
type ProductWithMongoId = BaseProduct & { _id?: string };

export default function AllProductsPage(): React.ReactElement {
    const {
        filteredProducts,
        loadingProducts,
        errorProducts,
        searchTerm,
        setSearchTerm,
        selectedCategory,
        setSelectedCategory,
    } = useAppContext();

    if (loadingProducts) {
        return (
            <div className="flex justify-center items-center min-h-screen text-xl font-semibold text-gray-700">
                <p>Chargement des produits...</p>
            </div>
        );
    }

    if (errorProducts) {
        return (
            <div className="flex flex-col justify-center items-center min-h-screen text-red-600 font-semibold text-lg text-center p-4">
                <p>Erreur lors du chargement des produits: {errorProducts}</p>
                <p className="mt-4">Veuillez rafraîchir la page ou vérifier votre connexion.</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col min-h-screen">
            <main className="flex-grow container mx-auto p-4 md:p-8 max-w-7xl">
                <h1 className="text-4xl md:text-5xl font-extrabold text-gray-900 mb-8 text-center drop-shadow-sm">
                    Découvrez tous nos Produits
                </h1>

                <div className="mb-12 flex flex-col md:flex-row items-center justify-center gap-4 md:gap-6 p-4 bg-white rounded-lg shadow-md">
                    <input
                        type="text"
                        placeholder="Rechercher par nom ou description..."
                        value={searchTerm}
                        onChange={(e: ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
                        className="p-3 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-full md:w-2/5 text-gray-800 placeholder-gray-500 transition duration-300 ease-in-out"
                        aria-label="Rechercher des produits"
                    />
                    <select
                        value={selectedCategory}
                        onChange={(e: ChangeEvent<HTMLSelectElement>) => setSelectedCategory(e.target.value)}
                        className="p-3 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-full md:w-1/4 bg-white text-gray-800 appearance-none pr-8 transition duration-300 ease-in-out"
                        aria-label="Filtrer par catégorie"
                    >
                        <option value="All">Toutes les catégories</option>
                        <option value="Ordinateurs">Ordinateurs</option>
                        <option value="Ecouteurs">Ecouteurs</option>
                        <option value="Televisions">Télévisions</option>
                        <option value="Accessoires">Accessoires</option>
                        <option value="Telephones">Téléphones</option>
                    </select>
                </div>

                {filteredProducts.length === 0 ? (
                    <p className="text-center text-gray-600 text-lg py-10">
                        Aucun produit ne correspond à votre recherche ou à vos filtres.
                    </p>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6 md:gap-8">
                        {filteredProducts.map((product: ProductWithMongoId) => {
                            // Transformation pour assurer la compatibilité de types
                            const safeProduct = {
                                ...product,
                                brand: product.brand ?? undefined, // null devient undefined
                                imgUrl: Array.isArray(product.imgUrl)
                                    ? product.imgUrl
                                    : product.imgUrl
                                    ? JSON.parse(product.imgUrl)
                                    : [],
                            };

                            return (
                                <ProductCard
                                    key={product.id || product._id}
                                    product={safeProduct}
                                />
                            );
                        })}
                    </div>
                )}
            </main>
            <Footer />
        </div>
    );
}
