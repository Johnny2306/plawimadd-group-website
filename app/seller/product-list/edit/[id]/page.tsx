// app/seller/product-list/edit/[id]/page.tsx
'use client';

import React, { useState, useEffect, FormEvent, ChangeEvent } from 'react';
import { assets } from '@/assets/assets';
import Image, { StaticImageData } from 'next/image';
import { toast } from 'react-toastify';
import { useRouter, useParams } from 'next/navigation';
import Loading from '@/components/Loading';
import { Product } from '@/lib/types'; // Importez l'interface Product depuis lib/types

// Définition des catégories avec des ID (idéalement, ces données devraient venir de votre backend)
// Pour l'instant, nous les mockons avec des IDs génériques pour que le code compile.
// VOUS DEVREZ REMPLACER CELA PAR UN VRAI APPEL API POUR RÉCUPÉRER VOS CATÉGORIES AVEC LEURS VRAIS IDs.
const MOCKED_CATEGORIES = [
    { id: 'cat_id_ordinateurs', name: 'Ordinateurs' },
    { id: 'cat_id_ecouteurs', name: 'Ecouteurs' },
    { id: 'cat_id_televisions', name: 'Télévisions' },
    { id: 'cat_id_accessoires', name: 'Accessoires' },
    { id: 'cat_id_telephones', name: 'Téléphones' },
];

/**
 * Composant de la page d'édition de produit pour les vendeurs.
 * Permet aux vendeurs de modifier les détails d'un produit existant.
 * @returns {React.ReactElement} Le JSX de la page d'édition de produit.
 */
const EditProduct = (): React.ReactElement => {
    const router = useRouter();
    const params = useParams();
    const productId: string = Array.isArray(params.id) ? params.id[0] : params.id || '';

    // États du formulaire
    const [imageFiles, setImageFiles] = useState<File[]>([]);
    const [existingImageUrls, setExistingImageUrls] = useState<string[]>([]);
    const [name, setName] = useState<string>('');
    const [description, setDescription] = useState<string>('');
    const [categoryName, setCategoryName] = useState<string>(MOCKED_CATEGORIES[0].name); // Pour l'affichage dans le select
    const [productCategoryId, setProductCategoryId] = useState<string>(MOCKED_CATEGORIES[0].id); // Pour l'envoi à l'API
    const [price, setPrice] = useState<string>('');
    const [offerPrice, setOfferPrice] = useState<string>('');
    const [stock, setStock] = useState<string>('');
    const [loading, setLoading] = useState<boolean>(true);
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

    // Effet pour charger les données du produit lors du montage du composant
    useEffect(() => {
        const fetchProductData = async () => {
            console.log("Attempting to fetch product with ID:", productId);
            if (!productId) {
                setLoading(false);
                console.error("Product ID is undefined.");
                toast.error("ID du produit manquant pour la modification.");
                router.push('/seller/product-list');
                return;
            }
            try {
                const res = await fetch(`/api/products/${productId}`);
                console.log("API Response status (GET):", res.status);

                if (!res.ok) {
                    const errorText = await res.text();
                    console.error("API Response not OK (GET). Status:", res.status, "Body:", errorText);
                    throw new Error("Produit non trouvé ou erreur de chargement.");
                }

                const data: { success: boolean; product?: Product; message?: string } = await res.json(); // Utilisation de l'interface Product
                console.log("API Response data (GET):", data);

                if (data.success && data.product) {
                    const product = data.product;
                    setName(product.name);
                    setDescription(product.description || ''); // Assurez que c'est une chaîne
                    setCategoryName(product.category.name); // Nom de la catégorie pour le select
                    setProductCategoryId(product.category.id); // ID de la catégorie pour l'API
                    setPrice(product.price.toString());
                    setOfferPrice(product.offerPrice?.toString() || '');
                    setStock(product.stock.toString());

                    // Logique de parsing des images existantes
                    let loadedImageUrls: string[] = [];
                    if (product.imgUrl) {
                        if (Array.isArray(product.imgUrl)) {
                            loadedImageUrls = product.imgUrl;
                        } else if (typeof product.imgUrl === 'string') {
                            try {
                                const parsed: string[] | string = JSON.parse(product.imgUrl);
                                if (Array.isArray(parsed)) {
                                    loadedImageUrls = parsed;
                                } else if (typeof parsed === 'string') {
                                    loadedImageUrls = [parsed];
                                }
                            } catch (e: unknown) {
                                // CORRECTION ICI: Assertion de type pour s'assurer que product.imgUrl est traité comme une string
                                if ((product.imgUrl as string).startsWith('/')) {
                                    loadedImageUrls = [product.imgUrl as string];
                                } else {
                                    loadedImageUrls = [];
                                }
                                console.warn("Impossible de parser product.imgUrl comme tableau JSON, traité comme URL unique ou tableau vide:", product.imgUrl, e);
                            }
                        }
                    }
                    setExistingImageUrls(loadedImageUrls);

                } else {
                    console.error("API response indicates failure or missing product data (GET):", data);
                    toast.error(data.message || "Échec du chargement du produit.");
                    router.push('/seller/product-list');
                }
            } catch (error: unknown) {
                console.error("Erreur de chargement du produit dans useEffect (GET):", error);
                toast.error(`Erreur: ${(error instanceof Error) ? error.message : "Une erreur inconnue est survenue."}`);
                router.push('/seller/product-list');
            } finally {
                setLoading(false);
            }
        };

        fetchProductData();
    }, [productId, router]);

    /**
     * Gère la soumission du formulaire de mise à jour du produit.
     * Télécharge les nouvelles images, puis envoie les données du produit mises à jour à l'API.
     * @param {FormEvent<HTMLFormElement>} e L'événement de soumission du formulaire.
     */
    const handleSubmit = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
        e.preventDefault();
        setIsSubmitting(true);

        // Validation frontend des champs obligatoires
        if (!name.trim() || !description.trim() || !productCategoryId.trim() || !price.trim() || !stock.trim()) {
            toast.error("Veuillez remplir tous les champs obligatoires (Nom, Description, Catégorie, Prix, Stock).");
            setIsSubmitting(false);
            return;
        }

        const parsedPrice = parseFloat(price);
        const parsedOfferPrice = offerPrice ? parseFloat(offerPrice) : null;
        const parsedStock = parseInt(stock, 10); // Spécifier la base 10

        if (isNaN(parsedPrice) || parsedPrice <= 0) {
            toast.error("Le prix doit être un nombre positif.");
            setIsSubmitting(false);
            return;
        }
        if (parsedOfferPrice !== null && (isNaN(parsedOfferPrice) || parsedOfferPrice <= 0)) {
            toast.error("Le prix promotionnel doit être un nombre positif ou vide.");
            setIsSubmitting(false);
            return;
        }
        if (isNaN(parsedStock) || parsedStock < 0) {
            toast.error("Le stock doit être un nombre entier non négatif.");
            setIsSubmitting(false);
            return;
        }

        let finalImageUrls: string[] = [...existingImageUrls]; // Commence avec les images existantes

        try {
            // Télécharge les nouvelles images ajoutées
            const newUploadedImageUrls: string[] = await Promise.all(
                imageFiles.filter(Boolean).map(async (file: File) => {
                    const formData = new FormData();
                    formData.append('image', file);

                    const uploadRes = await fetch('/api/upload-image', {
                        method: 'POST',
                        body: formData,
                    });

                    if (!uploadRes.ok) {
                        const err: { message?: string } = await uploadRes.json();
                        throw new Error(err.message || "Échec de l’upload d'une nouvelle image");
                    }

                    const data: { imageUrl: string } = await uploadRes.json();
                    return data.imageUrl;
                })
            );
            finalImageUrls = [...existingImageUrls, ...newUploadedImageUrls]; // Combine existantes et nouvelles

            if (finalImageUrls.length === 0) {
                toast.error("Veuillez télécharger au moins une image de produit.");
                setIsSubmitting(false);
                return;
            }

            // Création de l'objet productData avec les types corrects pour l'API
            const productData = {
                name,
                description,
                categoryId: productCategoryId, // ENVOI DE L'ID DE CATÉGORIE
                price: parsedPrice,
                offerPrice: parsedOfferPrice,
                stock: parsedStock,
                imgUrl: finalImageUrls, // ENVOI D'UN TABLEAU DE CHAÎNES
            };

            console.log("Sending product data for update (PUT):", productData); // LOG DE DÉBOGAGE POUR LA SOUMISSION

            const res = await fetch(`/api/products/${productId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(productData),
            });

            console.log("API Response status (PUT):", res.status); // LOG DE DÉBOGAGE POUR LA RÉPONSE PUT

            if (!res.ok) {
                const contentType = res.headers.get("content-type");
                let errMessage = "Erreur de mise à jour.";
                if (contentType && contentType.includes("application/json")) {
                    const errorData: { message?: string } = await res.json();
                    errMessage = errorData.message || errMessage;
                } else {
                    const errorText = await res.text();
                    errMessage = `API Response not OK (PUT). Status: ${res.status}. Body: ${errorText.substring(0, 100)}...`;
                    console.error("Non-JSON API Response (PUT):", errorText);
                }
                throw new Error(errMessage);
            }

            toast.success("Produit mis à jour avec succès !");
            router.push('/seller/product-list');

        } catch (error: unknown) {
            console.error("Erreur de mise à jour dans handleSubmit (PUT):", error);
            toast.error(`Erreur : ${(error instanceof Error) ? error.message : "Une erreur est survenue lors de la mise à jour."}`);
        } finally {
            setIsSubmitting(false);
        }
    };

    /**
     * Gère le changement de fichier pour les inputs d'image.
     * @param {ChangeEvent<HTMLInputElement>} e L'événement de changement de l'input de fichier.
     * @param {number} index L'index de l'image dans le tableau `imageFiles`.
     */
    const handleFileChange = (e: ChangeEvent<HTMLInputElement>, index: number): void => {
        const file = e.target.files?.[0];
        if (file) {
            const updatedFiles = [...imageFiles];
            updatedFiles[index] = file;
            setImageFiles(updatedFiles);
        }
    };

    /**
     * Supprime une URL d'image existante du tableau.
     * @param {string} urlToRemove L'URL de l'image à supprimer.
     */
    const removeExistingImage = (urlToRemove: string): void => {
        setExistingImageUrls(existingImageUrls.filter(url => url !== urlToRemove));
    };

    /**
     * Gère le changement de catégorie dans le sélecteur.
     * Met à jour le nom de la catégorie affiché et l'ID de la catégorie pour l'API.
     * @param {ChangeEvent<HTMLSelectElement>} e L'événement de changement du sélecteur.
     */
    const handleCategoryChange = (e: ChangeEvent<HTMLSelectElement>): void => {
        const selectedName = e.target.value;
        setCategoryName(selectedName);
        const foundCategory = MOCKED_CATEGORIES.find(cat => cat.name === selectedName);
        if (foundCategory) {
            setProductCategoryId(foundCategory.id);
        } else {
            setProductCategoryId(''); // Si la catégorie n'est pas trouvée (devrait pas arriver avec MOCKED_CATEGORIES)
            toast.error("Catégorie sélectionnée introuvable ou invalide.");
        }
    };

    if (loading) {
        return (
            <div className="flex-1 min-h-screen flex justify-center items-center bg-gray-50">
                <Loading />
            </div>
        );
    }

    return (
        <div className="flex-1 min-h-screen flex flex-col justify-center items-center bg-gray-50 p-4">
            <form onSubmit={handleSubmit} className="md:p-10 p-4 space-y-6 max-w-2xl w-full bg-white rounded-xl shadow-lg border border-gray-200">
                <h2 className="text-3xl font-bold text-gray-800 mb-4 text-center">Modifier le produit</h2>

                <div>
                    <label className="block mb-2 font-semibold text-gray-700">Images du produit</label>
                    <div className="flex flex-wrap gap-3 mb-3">
                        {/* Affichage des images existantes */}
                        {existingImageUrls.map((url: string, index: number) => (
                            <div key={`existing-${index}`} className="relative">
                                <Image
                                    src={url}
                                    alt={`Image existante ${index + 1}`}
                                    width={100}
                                    height={100}
                                    className="max-w-24 border border-blue-300 rounded-md p-1 object-cover"
                                    onError={(e: React.SyntheticEvent<HTMLImageElement, Event>) => {
                                        const target = e.target as HTMLImageElement;
                                        target.onerror = null;
                                        target.src = (assets.upload_area as StaticImageData).src;
                                    }}
                                />
                                <button
                                    type="button"
                                    onClick={() => removeExistingImage(url)}
                                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full h-6 w-6 flex items-center justify-center text-xs font-bold hover:bg-red-600 transition-colors duration-200 shadow-md"
                                    title="Supprimer cette image"
                                    aria-label={`Supprimer l'image existante ${index + 1}`}
                                >
                                    X
                                </button>
                            </div>
                        ))}
                        {/* Affichage des placeholders pour les nouvelles images */}
                        {[...Array(Math.max(0, 4 - existingImageUrls.length))].map((_, index: number) => (
                            <label key={`new-${index}`} htmlFor={`image-upload-${index}`} className="cursor-pointer">
                                <input
                                    type="file"
                                    id={`image-upload-${index}`}
                                    hidden
                                    accept="image/*"
                                    onChange={(e) => handleFileChange(e, index)}
                                    aria-label={`Télécharger une nouvelle image ${index + 1}`}
                                />
                                <Image
                                    src={imageFiles[index] ? URL.createObjectURL(imageFiles[index]) : (assets.upload_area as StaticImageData)}
                                    alt={`Nouvelle image ${index + 1}`}
                                    width={100}
                                    height={100}
                                    className="max-w-24 border border-gray-300 rounded-md p-1 object-cover hover:ring-2 hover:ring-blue-400 transition"
                                    onError={(e: React.SyntheticEvent<HTMLImageElement, Event>) => {
                                        const target = e.target as HTMLImageElement;
                                        target.onerror = null;
                                        target.src = (assets.upload_area as StaticImageData).src;
                                    }}
                                />
                            </label>
                        ))}
                    </div>
                    {existingImageUrls.length === 0 && imageFiles.filter(Boolean).length === 0 && (
                        <p className="text-red-500 text-sm" role="alert">Veuillez ajouter au moins une image.</p>
                    )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div>
                        <label htmlFor="productName" className="block mb-1 font-medium text-gray-700">Nom du produit</label>
                        <input
                            type="text"
                            id="productName"
                            required
                            value={name}
                            onChange={(e: ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
                            className="w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-400 outline-none"
                            placeholder="Ex : Ordinateur HP"
                            aria-label="Nom du produit"
                        />
                    </div>

                    <div>
                        <label htmlFor="productCategory" className="block mb-1 font-medium text-gray-700">Catégorie</label>
                        <select
                            id="productCategory"
                            value={categoryName} // Lié au nom de la catégorie pour l'affichage
                            onChange={handleCategoryChange} // Utilise le nouveau gestionnaire
                            className="w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-400 outline-none"
                            required
                            aria-label="Catégorie du produit"
                        >
                            {MOCKED_CATEGORIES.map((cat) => ( // Mappe les catégories mockées
                                <option key={cat.id} value={cat.name}>{cat.name}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label htmlFor="productPrice" className="block mb-1 font-medium text-gray-700">Prix</label>
                        <input
                            type="number"
                            id="productPrice"
                            required
                            value={price}
                            onChange={(e: ChangeEvent<HTMLInputElement>) => setPrice(e.target.value)}
                            className="w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-400 outline-none"
                            placeholder="100000"
                            aria-label="Prix du produit"
                        />
                    </div>

                    <div>
                        <label htmlFor="offerPrice" className="block mb-1 font-medium text-gray-700">Prix promotionnel</label>
                        <input
                            type="number"
                            id="offerPrice"
                            value={offerPrice}
                            onChange={(e: ChangeEvent<HTMLInputElement>) => setOfferPrice(e.target.value)}
                            className="w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-400 outline-none"
                            placeholder="90000"
                            aria-label="Prix promotionnel du produit (optionnel)"
                        />
                    </div>

                    <div>
                        <label htmlFor="productStock" className="block mb-1 font-medium text-gray-700">Stock</label>
                        <input
                            type="number"
                            id="productStock"
                            min="0"
                            required
                            value={stock}
                            onChange={(e: ChangeEvent<HTMLInputElement>) => setStock(e.target.value)}
                            className="w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-400 outline-none"
                            placeholder="Ex: 20"
                            aria-label="Quantité en stock du produit"
                        />
                    </div>
                </div>

                <div>
                    <label htmlFor="productDescription" className="block mb-1 font-medium text-gray-700">Description</label>
                    <textarea
                        id="productDescription"
                        required
                        rows={4}
                        value={description}
                        onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setDescription(e.target.value)}
                        className="w-full p-2 border rounded-md resize-none focus:ring-2 focus:ring-blue-400 outline-none"
                        placeholder="Décrivez le produit ici..."
                        aria-label="Description complète du produit"
                    ></textarea>
                </div>

                <button
                    type="submit"
                    disabled={isSubmitting || (existingImageUrls.length === 0 && imageFiles.filter(Boolean).length === 0)}
                    className="px-8 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition disabled:opacity-50 font-semibold w-full"
                    aria-label={isSubmitting ? "Mise à jour du produit en cours" : "Mettre à jour le produit"}
                >
                    {isSubmitting ? "Mise à jour en cours..." : "Mettre à jour le produit"}
                </button>
            </form>
        </div>
    );
};

export default EditProduct;
