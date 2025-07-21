// components/ProductList.tsx
'use client';
import React, { useEffect, useState } from 'react'; // Importez React, useEffect, useState
import { assets } from '@/assets/assets'; // Assurez-vous que le chemin est correct et que 'assets' est typé si possible
import Image, { StaticImageData } from 'next/image'; // Importez StaticImageData
import { useAppContext } from '@/context/AppContext'; // Assurez-vous que le contexte est bien typé
import Footer from '@/components/seller/Footer';
import Loading from '@/components/Loading';
import { toast } from 'react-toastify';
import { MdDeleteForever, MdEdit } from 'react-icons/md';
import ConfirmationModal from '@/components/ConfirmationModal'; // Assurez-vous que ce composant est bien typé aussi
import Link from 'next/link';
import { Product as ProductType } from '@/lib/types'; // Importez l'interface Product avec un alias

/**
 * Composant de la page de liste de produits pour les vendeurs.
 * Affiche tous les produits du vendeur, permet de les modifier ou de les supprimer.
 * @returns {React.ReactElement} Le JSX de la page de liste de produits.
 */
const ProductList = (): React.ReactElement => {
    // Utilisation du contexte global, assurez-vous que AppContext fournit les types corrects
    const { products, loadingProducts, fetchProducts, formatPrice } = useAppContext();

    // États du composant avec typage explicite
    const [showConfirmationModal, setShowConfirmationModal] = useState<boolean>(false);
    const [productIdToDelete, setProductIdToDelete] = useState<string | null>(null); // Stocke l'ID du produit à supprimer

    /**
     * Déclenche l'affichage de la modale de confirmation pour la suppression.
     * @param {string} productId L'ID du produit à supprimer.
     */
    const confirmDelete = (productId: string): void => {
        setProductIdToDelete(productId);
        setShowConfirmationModal(true);
    };

    /**
     * Exécute la suppression du produit après confirmation.
     */
    const executeDelete = async (): Promise<void> => {
        setShowConfirmationModal(false); // Ferme la modale
        if (!productIdToDelete) return; // S'assure qu'un ID est défini

        try {
            const response = await fetch(`/api/products/${productIdToDelete}`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
            });

            if (!response.ok) {
                const contentType = response.headers.get("content-type");
                if (contentType && contentType.includes("application/json")) {
                    const errorData: { message?: string } = await response.json(); // Type errorData
                    throw new Error(errorData.message || `Erreur ${response.status}`);
                } else {
                    throw new Error(`Erreur serveur ${response.status}`);
                }
            }

            const result: { success: boolean; message?: string } = await response.json(); // Type result
            if (result.success) {
                toast.success("Produit supprimé avec succès !");
                fetchProducts(); // Rafraîchit la liste des produits
            } else {
                toast.error(result.message || "Erreur de suppression.");
            }
        } catch (error: unknown) { // Type l'erreur comme unknown
            console.error("Erreur suppression :", error);
            toast.error(`Erreur : ${(error instanceof Error) ? error.message : "Une erreur inconnue est survenue."}`);
        } finally {
            setProductIdToDelete(null); // Réinitialise l'ID du produit à supprimer
        }
    };

    /**
     * Annule l'opération de suppression et ferme la modale.
     */
    const cancelDelete = (): void => {
        setShowConfirmationModal(false);
        setProductIdToDelete(null);
    };

    // Effet pour charger les produits au montage du composant (si nécessaire, le contexte peut déjà le faire)
    useEffect(() => {
        // fetchProducts est déjà appelé et géré par AppContext, donc pas besoin de le refaire ici
        // Cependant, si vous voulez vous assurer qu'il est appelé spécifiquement pour cette page:
        // fetchProducts();
    }, [fetchProducts]); // Dépendance de useEffect

    return (
        <div className="flex flex-col min-h-screen bg-gray-50">
            <main className="flex-1 p-4 md:p-8 lg:p-10">
                {loadingProducts ? (
                    <Loading />
                ) : (
                    <div className="w-full bg-white shadow-lg rounded-xl overflow-hidden border border-gray-200">
                        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
                            <h2 className="text-2xl font-semibold text-gray-800">Gérer Produits</h2>
                            <Link
                                href="/seller/add-products"
                                className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition"
                                aria-label="Ajouter un nouveau produit" // Ajouté pour l'accessibilité
                            >
                                + Ajouter un produit
                            </Link>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase w-2/5 sm:w-1/3">Produit</th>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase hidden sm:table-cell">Catégorie</th>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase w-1/5 sm:w-auto">Prix</th>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase w-1/5 sm:w-auto">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {products.length > 0 ? (
                                        products.map((product: ProductType) => { // Type product comme ProductType
                                            let imageUrls: string[] = []; // Type imageUrls

                                            if (Array.isArray(product.imgUrl)) {
                                                imageUrls = product.imgUrl;
                                            } else if (typeof product.imgUrl === 'string') {
                                                try {
                                                    const parsed: string[] | string = JSON.parse(product.imgUrl); // Type parsed
                                                    if (Array.isArray(parsed)) {
                                                        imageUrls = parsed;
                                                    } else {
                                                        imageUrls = [parsed];
                                                    }
                                                } catch {
                                                    imageUrls = [product.imgUrl];
                                                }
                                            }

                                            // Assurez-vous que mainImage est de type StaticImageData ou string
                                            const mainImage: StaticImageData | string = imageUrls.length > 0 && imageUrls[0]
                                                ? imageUrls[0]
                                                : (assets.upload_area as StaticImageData); // Cast pour StaticImageData

                                            const displayPrice: number = product.offerPrice && product.offerPrice < product.price
                                                ? product.offerPrice
                                                : product.price;

                                            return (
                                                <tr key={product.id} className="hover:bg-gray-50">
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <div className="flex items-center">
                                                            <div className="h-16 w-16 bg-gray-100 rounded-md overflow-hidden flex items-center justify-center"> {/* Ajout de flex pour centrer */}
                                                                <Image
                                                                    src={mainImage}
                                                                    alt={product.name || 'Image produit'} // Alt text descriptif
                                                                    width={64}
                                                                    height={64}
                                                                    className="h-full w-full object-contain p-1"
                                                                    onError={(e: React.SyntheticEvent<HTMLImageElement, Event>) => { // Type l'événement onError
                                                                        const target = e.target as HTMLImageElement; // Cast en HTMLImageElement
                                                                        target.onerror = null;
                                                                        target.src = (assets.upload_area as StaticImageData).src; // Utilise .src pour l'image par défaut
                                                                    }}
                                                                />
                                                            </div>
                                                            <div className="ml-4">
                                                                <div className="text-sm font-medium text-gray-900 truncate max-w-xs">
                                                                    {product.name}
                                                                </div>
                                                                <div className="text-sm text-gray-500 sm:hidden">
                                                                    {/* CORRECTION ICI: Accéder à .name si category est un objet */}
                                                                    {typeof product.category === 'object' && product.category !== null
                                                                        ? product.category.name
                                                                        : (product.category || 'N/A')}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 text-sm text-gray-500 hidden sm:table-cell">
                                                        {/* CORRECTION ICI: Accéder à .name si category est un objet */}
                                                        {typeof product.category === 'object' && product.category !== null
                                                            ? product.category.name
                                                            : (product.category || 'N/A')}
                                                    </td>
                                                    <td className="px-6 py-4 text-sm text-gray-900">
                                                        <div className="flex flex-col">
                                                            {formatPrice(displayPrice)}
                                                            {product.offerPrice && product.offerPrice < product.price && (
                                                                <span className="text-gray-400 line-through text-xs">
                                                                    {formatPrice(product.price)}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 text-sm font-medium">
                                                        <div className="flex space-x-2">
                                                            <Link
                                                                href={`/seller/product-list/edit/${product.id}`}
                                                                className="p-2 rounded-full bg-yellow-100 text-yellow-700 hover:bg-yellow-200"
                                                                title="Modifier le produit"
                                                                aria-label={`Modifier le produit ${product.name}`} // Ajouté pour l'accessibilité
                                                            >
                                                                <MdEdit className="h-5 w-5" aria-hidden='true' /> {/* Icône décorative */}
                                                            </Link>
                                                            <button
                                                                onClick={() => confirmDelete(product.id)}
                                                                className="p-2 rounded-full bg-red-100 text-red-600 hover:bg-red-200"
                                                                title="Supprimer le produit"
                                                                aria-label={`Supprimer le produit ${product.name}`} // Ajouté pour l'accessibilité
                                                            >
                                                                <MdDeleteForever className="h-5 w-5" aria-hidden='true' /> {/* Icône décorative */}
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    ) : (
                                        <tr>
                                            <td colSpan={4} className="text-center py-10 text-lg text-gray-600">
                                                Aucun produit trouvé.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </main>

            <Footer />

            <ConfirmationModal
                isOpen={showConfirmationModal}
                onClose={cancelDelete}
                onConfirm={executeDelete}
                title="Confirmer la suppression"
                message="Êtes-vous sûr de vouloir supprimer ce produit ? Cette action est irréversible."
            />
        </div>
    );
};

export default ProductList;
