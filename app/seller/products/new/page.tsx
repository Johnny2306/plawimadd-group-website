// app/seller/products/new/page.tsx
'use client';

import React, { useState, FormEvent, ChangeEvent } from 'react';
import { toast } from 'react-toastify';
import { useRouter } from 'next/navigation';
import Loading from '@/components/Loading'; // Assurez-vous que ce composant existe
import { ArrowLeft } from 'lucide-react'; // Icône de retour

// Définition des couleurs pour une cohérence UI (utilisées directement dans les classes Tailwind ou comme variables CSS si nécessaire)
// Ces variables ne sont pas directement utilisables comme `style={{ focusRingColor: ACCENT_COLOR }}`
// Pour Tailwind, on utilise des classes comme `focus:ring-indigo-500`
const ACCENT_COLOR = '#4F46E5'; // Bleu-violet
const NEUTRAL_COLOR_LIGHT = '#F8FAFC'; // Arrière-plan clair
const NEUTRAL_COLOR_DARK_TEXT = '#1F2937'; // Texte sombre principal
const TEXT_COLOR_DEFAULT = '#374151'; // Texte par défaut
const BORDER_COLOR = '#E5E7EB'; // Couleur des bordures et séparateurs

/**
 * @interface FormData
 * Représente la structure des données du formulaire pour un nouveau produit.
 */
interface FormData {
    name: string;
    sku: string; // Référence
    description: string;
    price: string; // Maintenu comme string pour l'input, converti pour l'API
    stock: string; // Maintenu comme string pour l'input, converti pour l'API
    category: string; // Famille
    imgUrl: string; // URL de l'image
}

/**
 * Composant de la page d'ajout d'un nouveau produit.
 * Permet aux vendeurs d'enregistrer les détails d'un nouveau produit dans le système.
 * @returns {React.ReactElement} Le JSX de la page d'ajout de nouveau produit.
 */
const NewProductPage = (): React.ReactElement => {
    const router = useRouter();
    const [formData, setFormData] = useState<FormData>({
        name: '',
        sku: '',
        description: '',
        price: '',
        stock: '',
        category: '',
        imgUrl: '',
    });
    const [loading, setLoading] = useState<boolean>(false); // Indique si une opération est en cours

    /**
     * Gère les changements dans les champs du formulaire et met à jour l'état `formData`.
     * @param {ChangeEvent<HTMLInputElement | HTMLTextAreaElement>} e L'événement de changement de l'input ou textarea.
     */
    const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>): void => {
        const { name, value } = e.target;
        setFormData((prevData) => ({
            ...prevData,
            [name]: value,
        }));
    };

    /**
     * Gère la soumission du formulaire, envoie les données du produit à l'API.
     * @param {FormEvent<HTMLFormElement>} e L'événement de soumission du formulaire.
     */
    const handleSubmit = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
        e.preventDefault();
        setLoading(true);

        try {
            const res = await fetch('/api/seller/products', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    ...formData,
                    price: parseFloat(formData.price), // Convertir en nombre
                    stock: parseInt(formData.stock, 10), // Convertir en entier
                }),
            });

            const data: { success: boolean; message?: string } = await res.json(); // Type la réponse

            if (res.ok && data.success) {
                toast.success('Produit enregistré avec succès !');
                router.push('/seller/stocks'); // Rediriger vers la page de gestion des stocks
            } else {
                toast.error(data.message || 'Erreur lors de l\'enregistrement du produit.');
            }
        } catch (error: unknown) { // Type l'erreur comme unknown
            console.error('Erreur lors de l\'enregistrement du produit:', error);
            toast.error(`Impossible d'enregistrer le produit : ${(error instanceof Error) ? error.message : "Erreur inconnue"}`);
        } finally {
            setLoading(false);
        }
    };

    // Affiche un indicateur de chargement si `loading` est vrai
    if (loading) {
        return (
            <div className="flex-1 min-h-screen flex items-center justify-center" style={{ backgroundColor: NEUTRAL_COLOR_LIGHT }}>
                <Loading />
            </div>
        );
    }

    return (
        <div className="flex flex-col min-h-screen" style={{ backgroundColor: NEUTRAL_COLOR_LIGHT }}>
            <main className="flex-1 p-6 md:p-10">
                <div className="max-w-4xl mx-auto bg-white rounded-xl p-8 shadow-lg border" style={{ borderColor: BORDER_COLOR }}>
                    <button
                        onClick={() => router.back()}
                        className="mb-6 inline-flex items-center text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors duration-200"
                        aria-label="Retour à la page précédente" // Ajouté pour l'accessibilité
                    >
                        <ArrowLeft className="w-4 h-4 mr-2" aria-hidden='true' /> {/* Icône décorative */}
                        Retour
                    </button>
                    <h1 className="text-3xl md:text-4xl font-extrabold mb-8 text-center" style={{ color: NEUTRAL_COLOR_DARK_TEXT }}>
                        Enregistrer un Nouveau Produit
                    </h1>

                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div>
                            <label htmlFor="name" className="block text-sm font-medium" style={{ color: TEXT_COLOR_DEFAULT }}>
                                Nom du Produit
                            </label>
                            <input
                                type="text"
                                id="name"
                                name="name"
                                value={formData.name}
                                onChange={handleChange}
                                required
                                className="mt-1 block w-full border rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                // focusRingColor n'est pas une propriété CSS standard. Tailwind le gère via focus:ring-*
                                style={{ borderColor: BORDER_COLOR }}
                                aria-label="Nom du produit" // Ajouté pour l'accessibilité
                            />
                        </div>
                        <div>
                            <label htmlFor="sku" className="block text-sm font-medium" style={{ color: TEXT_COLOR_DEFAULT }}>
                                Référence (SKU)
                            </label>
                            <input
                                type="text"
                                id="sku"
                                name="sku"
                                value={formData.sku}
                                onChange={handleChange}
                                required
                                className="mt-1 block w-full border rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                style={{ borderColor: BORDER_COLOR }}
                                aria-label="Référence du produit (SKU)" // Ajouté pour l'accessibilité
                            />
                        </div>
                        <div>
                            <label htmlFor="description" className="block text-sm font-medium" style={{ color: TEXT_COLOR_DEFAULT }}>
                                Description
                            </label>
                            <textarea
                                id="description"
                                name="description"
                                value={formData.description}
                                onChange={handleChange}
                                rows={3}
                                className="mt-1 block w-full border rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm resize-y" // Ajout de resize-y
                                style={{ borderColor: BORDER_COLOR }}
                                aria-label="Description du produit" // Ajouté pour l'accessibilité
                            ></textarea>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label htmlFor="price" className="block text-sm font-medium" style={{ color: TEXT_COLOR_DEFAULT }}>
                                    Prix (XOF)
                                </label>
                                <input
                                    type="number"
                                    id="price"
                                    name="price"
                                    value={formData.price}
                                    onChange={handleChange}
                                    step="0.01"
                                    min="0"
                                    required
                                    className="mt-1 block w-full border rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                    style={{ borderColor: BORDER_COLOR }}
                                    aria-label="Prix du produit en XOF" // Ajouté pour l'accessibilité
                                />
                            </div>
                            <div>
                                <label htmlFor="stock" className="block text-sm font-medium" style={{ color: TEXT_COLOR_DEFAULT }}>
                                    Stock Initial
                                </label>
                                <input
                                    type="number"
                                    id="stock"
                                    name="stock"
                                    value={formData.stock}
                                    onChange={handleChange}
                                    min="0"
                                    required
                                    className="mt-1 block w-full border rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                    style={{ borderColor: BORDER_COLOR }}
                                    aria-label="Stock initial du produit" // Ajouté pour l'accessibilité
                                />
                            </div>
                        </div>
                        <div>
                            <label htmlFor="category" className="block text-sm font-medium" style={{ color: TEXT_COLOR_DEFAULT }}>
                                Famille (Catégorie)
                            </label>
                            <input
                                type="text"
                                id="category"
                                name="category"
                                value={formData.category}
                                onChange={handleChange}
                                required
                                className="mt-1 block w-full border rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                style={{ borderColor: BORDER_COLOR }}
                                aria-label="Catégorie du produit" // Ajouté pour l'accessibilité
                            />
                        </div>
                        <div>
                            <label htmlFor="imgUrl" className="block text-sm font-medium" style={{ color: TEXT_COLOR_DEFAULT }}>
                                URL de l&#39;Image du Produit
                            </label>
                            <input
                                type="url"
                                id="imgUrl"
                                name="imgUrl"
                                value={formData.imgUrl}
                                onChange={handleChange}
                                className="mt-1 block w-full border rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                style={{ borderColor: BORDER_COLOR }}
                                aria-label="URL de l'image du produit" // Ajouté pour l'accessibilité
                            />
                        </div>
                        <div>
                            <button
                                type="submit"
                                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors duration-200"
                                // hoverBackgroundColor n'est pas une propriété CSS standard. Tailwind le gère via hover:bg-*
                                style={{ backgroundColor: ACCENT_COLOR }}
                                disabled={loading}
                                aria-label={loading ? 'Enregistrement du produit en cours...' : 'Enregistrer le Produit'} // Ajouté pour l'accessibilité
                            >
                                {loading ? 'Enregistrement...' : 'Enregistrer le Produit'}
                            </button>
                        </div>
                    </form>
                </div>
            </main>
        </div>
    );
};

export default NewProductPage;
