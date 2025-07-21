// app/seller/add-products/page.tsx
'use client';
import React, { useState, FormEvent, ChangeEvent } from 'react'; // Importez React et les types d'événements
import { assets } from '@/assets/assets';
import Image from 'next/image';
import { toast } from 'react-toastify';
import { useRouter } from 'next/navigation';
import { StaticImageData } from 'next/image'; // Importez StaticImageData

// Définition des catégories avec un type explicite
const CATEGORIES: string[] = [
    "Ordinateurs",
    "Ecouteurs",
    "Télévisions",
    "Accessoires",
    "Téléphones",
];

/**
 * Composant de la page d'ajout de produit pour les vendeurs.
 * Permet aux vendeurs d'ajouter de nouveaux produits à la plateforme, y compris les images et les détails.
 * @returns {React.ReactElement} Le JSX de la page d'ajout de produit.
 */
const AddProduct = (): React.ReactElement => {
    const router = useRouter();

    // États du formulaire avec typage explicite
    const [imageFiles, setImageFiles] = useState<File[]>([]); // Tableau de fichiers pour les images
    const [name, setName] = useState<string>('');
    const [description, setDescription] = useState<string>('');
    const [category, setCategory] = useState<string>(CATEGORIES[0]);
    const [price, setPrice] = useState<string>(''); // Stocké comme string pour l'input, converti en float pour l'API
    const [offerPrice, setOfferPrice] = useState<string>(''); // Stocké comme string, converti en float ou null
    const [stock, setStock] = useState<string>(''); // Stocké comme string, converti en int
    const [loading, setLoading] = useState<boolean>(false);

    /**
     * Gère la soumission du formulaire d'ajout de produit.
     * Télécharge les images, puis envoie les données du produit à l'API.
     * @param {FormEvent<HTMLFormElement>} e L'événement de soumission du formulaire.
     */
    const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setLoading(true);

        const validFiles = imageFiles.filter(Boolean); // Filtrer les éléments null/undefined
        if (validFiles.length === 0) {
            toast.error("Veuillez télécharger au moins une image de produit.");
            setLoading(false);
            return;
        }

        try {
            const uploadedImageUrls: string[] = await Promise.all( // Type le tableau de URLs
                validFiles.map(async (file: File) => { // Type 'file' comme File
                    const formData = new FormData();
                    formData.append('image', file);

                    const uploadRes = await fetch('/api/upload-image', {
                        method: 'POST',
                        body: formData,
                    });

                    if (!uploadRes.ok) {
                        const err = await uploadRes.json();
                        throw new Error(err.message || "Échec de l’upload de l'image.");
                    }

                    const data: { imageUrl: string } = await uploadRes.json(); // Type la réponse de l'upload
                    return data.imageUrl;
                })
            );

            // Création de l'objet productData avec les types corrects
            const productData = {
                name,
                description,
                category,
                price: parseFloat(price),
                offerPrice: offerPrice ? parseFloat(offerPrice) : null,
                stock: parseInt(stock),
                imgUrl: JSON.stringify(uploadedImageUrls), // imgUrl est une chaîne JSON d'un tableau d'URL
            };

            const res = await fetch('/api/products', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(productData),
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.message || "Erreur d’enregistrement du produit.");
            }

            toast.success("Produit ajouté avec succès !");
            router.push('/seller/product-list'); // Redirige après succès

        } catch (error: unknown) { // Type l'erreur comme unknown
            console.error("Erreur d'ajout :", error);
            // Vérifie si l'erreur est une instance d'Error pour accéder à 'message'
            toast.error((error instanceof Error) ? error.message : "Une erreur est survenue.");
        } finally {
            setLoading(false);
        }
    };

    /**
     * Gère le changement de fichier pour les inputs d'image.
     * @param {ChangeEvent<HTMLInputElement>} e L'événement de changement de l'input de fichier.
     * @param {number} index L'index de l'image dans le tableau.
     */
    const handleFileChange = (e: ChangeEvent<HTMLInputElement>, index: number) => {
        const file = e.target.files?.[0]; // Utilise l'opérateur de chaînage optionnel
        if (file) {
            const updatedFiles = [...imageFiles];
            updatedFiles[index] = file;
            setImageFiles(updatedFiles);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-100 flex items-center justify-center px-4 py-10">
            <form
                onSubmit={handleSubmit}
                className="w-full max-w-2xl bg-white rounded-2xl shadow-lg border border-gray-200 p-6 md:p-10 space-y-6"
            >
                <h2 className="text-3xl font-bold text-gray-800 mb-4 text-center">Ajouter un produit</h2>

                {/* Images */}
                <div>
                    <label className="block mb-2 font-semibold text-gray-700">Images du produit</label>
                    <div className="flex flex-wrap gap-4">
                        {[...Array(4)].map((_, index: number) => ( // Type index
                            <label key={index} htmlFor={`image-upload-${index}`} className="cursor-pointer">
                                <input
                                    type="file"
                                    id={`image-upload-${index}`}
                                    hidden
                                    accept="image/*"
                                    onChange={(e) => handleFileChange(e, index)}
                                    aria-label={`Télécharger l'image ${index + 1}`} // Ajouté pour l'accessibilité
                                />
                                <Image
                                    src={imageFiles[index] ? URL.createObjectURL(imageFiles[index]) : (assets.upload_area as StaticImageData)} // Cast pour StaticImageData
                                    alt={`Image du produit ${index + 1}`} // Alt text descriptif
                                    width={100}
                                    height={100}
                                    className="max-w-24 border border-gray-300 rounded-lg p-1 hover:ring-2 hover:ring-blue-400 transition object-cover" // Ajout de object-cover
                                />
                            </label>
                        ))}
                    </div>
                </div>

                {/* Champs */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div>
                        <label htmlFor="productName" className="block mb-1 text-gray-700 font-medium">Nom du produit</label>
                        <input
                            type="text"
                            id="productName" // Ajout d'un id pour la label
                            required
                            value={name}
                            onChange={(e: ChangeEvent<HTMLInputElement>) => setName(e.target.value)} // Type l'événement
                            className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-400 outline-none"
                            placeholder="Ex : Ordinateur HP"
                            aria-label="Nom du produit" // Ajouté pour l'accessibilité
                        />
                    </div>

                    <div>
                        <label htmlFor="productCategory" className="block mb-1 text-gray-700 font-medium">Catégorie</label>
                        <select
                            id="productCategory" // Ajout d'un id pour la label
                            value={category}
                            onChange={(e: ChangeEvent<HTMLSelectElement>) => setCategory(e.target.value)} // Type l'événement
                            className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-400 outline-none"
                            required
                            aria-label="Catégorie du produit" // Ajouté pour l'accessibilité
                        >
                            {CATEGORIES.map((cat: string) => ( // Type cat
                                <option key={cat} value={cat}>{cat}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label htmlFor="productPrice" className="block mb-1 text-gray-700 font-medium">Prix</label>
                        <input
                            type="number"
                            id="productPrice" // Ajout d'un id pour la label
                            required
                            value={price}
                            onChange={(e: ChangeEvent<HTMLInputElement>) => setPrice(e.target.value)} // Type l'événement
                            className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-400 outline-none"
                            placeholder="100000"
                            aria-label="Prix du produit" // Ajouté pour l'accessibilité
                        />
                    </div>

                    <div>
                        <label htmlFor="offerPrice" className="block mb-1 text-gray-700 font-medium">Prix promotionnel</label>
                        <input
                            type="number"
                            id="offerPrice" // Ajout d'un id pour la label
                            value={offerPrice}
                            onChange={(e: ChangeEvent<HTMLInputElement>) => setOfferPrice(e.target.value)} // Type l'événement
                            className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-400 outline-none"
                            placeholder="90000"
                            aria-label="Prix promotionnel du produit (optionnel)" // Ajouté pour l'accessibilité
                        />
                    </div>

                    <div>
                        <label htmlFor="productStock" className="block mb-1 text-gray-700 font-medium">Stock</label>
                        <input
                            type="number"
                            id="productStock" // Ajout d'un id pour la label
                            min="0"
                            required
                            value={stock}
                            onChange={(e: ChangeEvent<HTMLInputElement>) => setStock(e.target.value)} // Type l'événement
                            className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-400 outline-none"
                            placeholder="Ex: 20"
                            aria-label="Quantité en stock du produit" // Ajouté pour l'accessibilité
                        />
                    </div>
                </div>

                {/* Description */}
                <div>
                    <label htmlFor="productDescription" className="block mb-1 text-gray-700 font-medium">Description</label>
                    <textarea
                        id="productDescription" // Ajout d'un id pour la label
                        required
                        rows={4}
                        value={description}
                        onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setDescription(e.target.value)} // Type l'événement
                        className="w-full p-3 border rounded-lg resize-none focus:ring-2 focus:ring-blue-400 outline-none"
                        placeholder="Décrivez le produit ici..."
                        aria-label="Description complète du produit" // Ajouté pour l'accessibilité
                    ></textarea>
                </div>

                {/* Bouton */}
                <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition disabled:opacity-50"
                    aria-label={loading ? "Ajout du produit en cours" : "Ajouter le produit"} // Ajouté pour l'accessibilité
                >
                    {loading ? "Ajout en cours..." : "Ajouter le produit"}
                </button>
            </form>
        </div>
    );
};

export default AddProduct;
