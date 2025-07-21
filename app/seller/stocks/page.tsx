// app/seller/stocks/page.tsx
'use client'; // Cette directive marque le composant comme un composant client

import React, { useState, useEffect, FormEvent, ChangeEvent } from 'react';
import Image from 'next/image'; // Importez Image de next/image
import { toast } from 'react-toastify'; // Importez toast
import { Product as ProductTypeFromLib } from '@/lib/types'; // Importez l'interface Product depuis lib/types

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

// Interface pour les données d'un produit après traitement pour l'affichage dans ce composant
// Elle correspond à la forme finale des objets stockés dans le tableau 'products' de l'état.
interface DisplayProduct {
    id: string;
    name: string;
    description: string;
    category: string; // Le nom de la catégorie sera une chaîne ici (pour l'affichage)
    categoryId: string; // L'ID de la catégorie (pour l'envoi à l'API)
    price: number;
    offerPrice: number | null;
    stock: number;
    imgUrl: string; // Une seule URL de chaîne pour l'affichage
    createdAt: Date; // Assurez-vous que ces champs existent dans ProductTypeFromLib
    updatedAt: Date; // Assurez-vous que ces champs existent dans ProductTypeFromLib
}

// Interface pour les données du formulaire d'édition
interface EditForm {
    id: string;
    name: string;
    description: string;
    category: string; // Pour l'input de catégorie, ce sera le nom
    categoryId: string; // NOUVEAU: Pour stocker l'ID réel de la catégorie
    price: string;
    offerPrice: string;
    stock: string;
    imgUrl: string; // Pour l'input d'image, ce sera une seule URL
}

// Composant pour la page de gestion des stocks
const StockPage = (): React.ReactElement => {
    // État pour stocker la liste des produits
    const [products, setProducts] = useState<DisplayProduct[]>([]); // Utilisation de DisplayProduct
    // État pour gérer le produit en cours d'édition
    const [editingProduct, setEditingProduct] = useState<DisplayProduct | null>(null); // Utilisation de DisplayProduct
    // État pour les valeurs du formulaire d'édition
    const [editForm, setEditForm] = useState<EditForm>({
        id: '',
        name: '',
        description: '',
        category: '',
        categoryId: '', // Initialisation du nouvel état
        price: '',
        offerPrice: '',
        stock: '',
        imgUrl: ''
    });
    // État pour le message de confirmation/erreur
    const [message, setMessage] = useState<string>('');
    // État pour gérer l'état de chargement des données
    const [loading, setLoading] = useState<boolean>(true);
    // État pour gérer les erreurs de chargement
    const [error, setError] = useState<string | null>(null);

    // Fonction de formatage des prix (à implémenter ou importer depuis un contexte si disponible)
    const formatPrice = (amount: number): string => {
        return new Intl.NumberFormat('fr-FR', {
            style: 'currency',
            currency: 'XOF',
            minimumFractionDigits: 0, // Pas de décimales pour les FCFA
        }).format(amount);
    };

    // Effet pour charger les données des produits depuis l'API backend
    useEffect(() => {
        const fetchProducts = async (): Promise<void> => {
            setLoading(true);
            setError(null);
            try {
                const response = await fetch('/api/products'); // Assurez-vous que cette API retourne une liste de produits
                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(`Erreur HTTP: ${response.status} - ${errorText}`);
                }
                // Les données brutes de l'API devraient correspondre à ProductTypeFromLib
                const data: ProductTypeFromLib[] = await response.json();

                console.log("[StockPage] Raw API product data:", data); // Log des données brutes de l'API

                const processedProducts: DisplayProduct[] = data.map(product => {
                    let imageUrl = '';
                    console.log(`[StockPage] Processing product ${product.id}, imgUrl type: ${typeof product.imgUrl}, value:`, product.imgUrl); // Log détaillé de imgUrl

                    if (product.imgUrl) {
                        if (Array.isArray(product.imgUrl)) {
                            // Si c'est un tableau, prend la première URL valide
                            const firstValidUrl = product.imgUrl.find(item => typeof item === 'string' && item.length > 0);
                            imageUrl = firstValidUrl || '';
                        } else if (typeof product.imgUrl === 'string') {
                            try {
                                const parsedImgUrl: unknown = JSON.parse(product.imgUrl); // Parser comme unknown
                                if (Array.isArray(parsedImgUrl) && parsedImgUrl.length > 0 && parsedImgUrl.every(item => typeof item === 'string')) {
                                    imageUrl = parsedImgUrl[0]; // Prend la première image si c'est un tableau JSON
                                } else if (typeof parsedImgUrl === 'string' && parsedImgUrl.length > 0) {
                                    imageUrl = parsedImgUrl; // Si c'est une chaîne après parsing (ex: "url_simple")
                                } else {
                                    // Si JSON.parse renvoie un objet vide, null, ou un type inattendu
                                    console.warn(`[StockPage] Parsed imgUrl for product ${product.id} is not a valid string or array of strings, or is empty object:`, parsedImgUrl);
                                    imageUrl = ''; // Défaut à une chaîne vide
                                }
                            } catch (e: unknown) {
                                // Si JSON.parse échoue, c'est probablement une URL directe non-JSON
                                if (typeof product.imgUrl === 'string' && (product.imgUrl as string).length > 0) { 
                                    imageUrl = product.imgUrl;
                                } else {
                                    imageUrl = '';
                                }
                                console.warn(`[StockPage] Failed to JSON parse imgUrl for product ${product.id}, treating as direct URL or empty:`, product.imgUrl, e);
                            }
                        } else {
                            // Si product.imgUrl n'est ni un tableau ni une chaîne (ex: un objet vide {} ou autre)
                            console.warn(`[StockPage] product.imgUrl for product ${product.id} is of unexpected type (not string, not array):`, product.imgUrl);
                            imageUrl = '';
                        }
                    }
                    console.log(`[StockPage] Final imageUrl for product ${product.id}:`, imageUrl); // Log de l'URL finale

                    // Assurez-vous que la catégorie est une chaîne et récupérez son ID
                    let categoryName: string;
                    let categoryId: string;

                    if (typeof product.category === 'object' && product.category !== null && 'name' in product.category && 'id' in product.category) {
                        categoryName = product.category.name;
                        categoryId = product.category.id;
                    } else if (typeof product.category === 'string') {
                        categoryName = product.category;
                        // Tente de trouver l'ID à partir du nom de la catégorie mockée
                        const matchedCategory = MOCKED_CATEGORIES.find(cat => cat.name === categoryName);
                        categoryId = matchedCategory ? matchedCategory.id : 'UNKNOWN_CATEGORY_ID'; // Fallback si non trouvé
                    } else {
                        categoryName = 'Général';
                        categoryId = 'UNKNOWN_CATEGORY_ID';
                    }

                    // Retourne un objet de type DisplayProduct
                    return {
                        id: product.id,
                        name: product.name,
                        description: product.description || '',
                        category: categoryName, // Assuré d'être une chaîne
                        categoryId: categoryId, // L'ID de la catégorie
                        price: typeof product.price === 'string' ? parseFloat(product.price) : product.price,
                        offerPrice: product.offerPrice ? parseFloat(String(product.offerPrice)) : null,
                        stock: parseInt(product.stock.toString(), 10),
                        imgUrl: imageUrl, // Assuré d'être une chaîne
                        createdAt: new Date(product.createdAt), // Convertir en Date
                        updatedAt: new Date(product.updatedAt), // Convertir en Date
                    };
                });
                setProducts(processedProducts);
            } catch (err: unknown) {
                console.error("[StockPage] Erreur lors de la récupération des produits:", err);
                setError(`Impossible de charger les produits. Veuillez vérifier que votre API est fonctionnelle et que les données sont au bon format. Erreur: ${(err instanceof Error) ? err.message : "Inconnue"}`);
            } finally {
                setLoading(false);
            }
        };

        fetchProducts();
    }, []);

    // Gère l'ouverture du modal d'édition
    const handleEditClick = (product: DisplayProduct): void => { // Utilisation de DisplayProduct
        setEditingProduct(product);
        setEditForm({
            id: product.id,
            name: product.name,
            description: product.description,
            category: product.category, // C'est déjà le nom de la catégorie ici
            categoryId: product.categoryId, // NOUVEAU: Stocke l'ID réel de la catégorie
            price: product.price.toString(),
            offerPrice: product.offerPrice !== null ? product.offerPrice.toString() : '',
            stock: product.stock.toString(),
            imgUrl: product.imgUrl // C'est déjà une chaîne ici
        });
        setMessage('');
    };

    // Gère la fermeture du modal d'édition
    const handleCloseModal = (): void => {
        setEditingProduct(null);
        setEditForm({ id: '', name: '', stock: '', price: '', description: '', category: '', categoryId: '', offerPrice: '', imgUrl: '' }); // Réinitialise categoryId
        setMessage('');
    };

    // Gère les changements dans le formulaire d'édition
    const handleFormChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>): void => {
        const { name, value } = e.target;
        setEditForm(prev => ({ ...prev, [name]: value }));
    };

    // Gère la soumission du formulaire d'édition
    const handleFormSubmit = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
        e.preventDefault();
        setMessage('Mise à jour en cours...');

        // Validation frontend
        if (!editForm.name.trim() || !editForm.description.trim() || !editForm.category.trim() || !editForm.price.trim() || !editForm.stock.trim() || !editForm.imgUrl.trim()) {
            setMessage('Veuillez remplir tous les champs obligatoires.');
            setTimeout(() => setMessage(''), 3000);
            return;
        }

        const parsedPrice = parseFloat(editForm.price);
        const parsedOfferPrice = editForm.offerPrice !== '' ? parseFloat(editForm.offerPrice) : null;
        const parsedStock = parseInt(editForm.stock, 10);

        if (isNaN(parsedPrice) || parsedPrice <= 0) {
            setMessage('Le prix doit être un nombre positif.');
            setTimeout(() => setMessage(''), 3000);
            return;
        }
        if (parsedOfferPrice !== null && (isNaN(parsedOfferPrice) || parsedOfferPrice <= 0)) {
            setMessage('Le prix promotionnel doit être un nombre positif ou vide.');
            setTimeout(() => setMessage(''), 3000);
            return;
        }
        if (isNaN(parsedStock) || parsedStock < 0) {
            setMessage('Le stock doit être un nombre entier non négatif.');
            setTimeout(() => setMessage(''), 3000);
            return;
        }

        // Utilise directement editForm.categoryId qui contient l'ID réel de la catégorie
        const categoryIdToSend = editForm.categoryId;

        // Préparation des données à envoyer à l'API
        // Ceci correspond maintenant aux attentes de l'API PUT /api/products/[id]
        const dataToSend = {
            name: editForm.name,
            description: editForm.description,
            categoryId: categoryIdToSend, // ENVOI DE L'ID DE CATÉGORIE
            price: parsedPrice,
            offerPrice: parsedOfferPrice,
            stock: parsedStock,
            imgUrl: [editForm.imgUrl], // L'API attend un tableau de chaînes
        };

        console.log("[StockPage] Sending update data:", dataToSend); // Log des données envoyées

        try {
            const response = await fetch(`/api/products/${editForm.id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(dataToSend),
            });

            const result: { success: boolean; message?: string } = await response.json();

            if (!response.ok || !result.success) {
                throw new Error(`Erreur HTTP: ${response.status} - ${result.message || 'Erreur inconnue'}`);
            }

            // Met à jour l'état local des produits après un succès API
            setProducts(products.map(p =>
                p.id === editForm.id ? {
                    ...p,
                    name: dataToSend.name,
                    description: dataToSend.description,
                    category: editForm.category, // Conserve le nom de la catégorie pour l'affichage
                    categoryId: dataToSend.categoryId, // Conserve l'ID de la catégorie
                    price: dataToSend.price,
                    offerPrice: dataToSend.offerPrice,
                    stock: dataToSend.stock,
                    imgUrl: dataToSend.imgUrl[0] || '', // Met à jour avec la première URL du tableau
                    // Conservez createdAt et updatedAt de l'ancien produit car ils ne sont pas envoyés dans dataToSend
                    createdAt: p.createdAt,
                    updatedAt: p.updatedAt,
                } : p
            ));
            setMessage('Produit mis à jour avec succès !');
            toast.success('Produit mis à jour avec succès !'); // Utilisation de toast

            setTimeout(() => {
                setMessage('');
            }, 3000);

            setEditingProduct(null); // Ferme le modal
        } catch (err: unknown) {
            console.error("[StockPage] Erreur lors de la mise à jour du produit:", err);
            const errMsg = `Erreur lors de la mise à jour: ${(err instanceof Error) ? err.message : "Erreur inconnue"}. Veuillez vérifier votre API.`;
            setMessage(errMsg);
            toast.error(errMsg); // Utilisation de toast
        }
    };

    return (
        <div className="min-h-screen bg-gray-100 p-8 font-sans">
            <div className="w-full max-w-screen-xl mx-auto bg-white p-6 rounded-xl shadow-lg">
                <h1 className="text-3xl font-bold text-gray-800 mb-6 text-center">Gestion du Stock des Produits</h1>

                {message && (
                    <div className={`p-3 mb-4 rounded-md text-center ${message.includes('succès') ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`} role='status'>
                        {message}
                    </div>
                )}

                {loading && (
                    <div className="text-center text-blue-600 text-lg" role='status'>Chargement des produits...</div>
                )}

                {error && (
                    <div className="p-3 mb-4 rounded-md text-center bg-red-100 text-red-700" role='alert'>
                        {error}
                    </div>
                )}

                {!loading && !error && (
                    <div className="overflow-x-auto rounded-lg shadow-md">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th scope="col" className="py-3 px-4 text-center text-sm font-semibold text-gray-700 uppercase tracking-wider rounded-tl-lg">Référence</th>
                                    <th scope="col" className="py-3 px-4 text-center text-sm font-semibold text-gray-700 uppercase tracking-wider">Image</th>
                                    <th scope="col" className="py-3 px-4 text-center text-sm font-semibold text-gray-700 uppercase tracking-wider">Nom du Produit</th>
                                    <th scope="col" className="py-3 px-4 text-center text-sm font-semibold text-gray-700 uppercase tracking-wider">Quantité en Stock</th>
                                    <th scope="col" className="py-3 px-4 text-center text-sm font-semibold text-gray-700 uppercase tracking-wider">Prix Unitaire</th>
                                    <th scope="col" className="py-3 px-4 text-center text-sm font-semibold text-gray-700 uppercase tracking-wider">Prix Total</th>
                                    <th scope="col" className="py-3 px-4 text-center text-sm font-semibold text-gray-700 uppercase tracking-wider rounded-tr-lg">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {products.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="py-4 px-4 text-center text-gray-500">Aucun produit trouvé.</td>
                                    </tr>
                                ) : (
                                    products.map((product: DisplayProduct, index: number) => ( // Utilisation de DisplayProduct
                                        <tr key={product.id} className={`${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-gray-100 transition-colors duration-200`}>
                                            <td className="py-3 px-4 border-b border-gray-200 text-gray-800 text-center whitespace-nowrap">{product.id}</td>
                                            <td className="py-3 px-4 border-b border-gray-200 text-center whitespace-nowrap">
                                                {product.imgUrl ? (
                                                    <Image
                                                        src={product.imgUrl} // C'est déjà une chaîne valide ici
                                                        alt={product.name || 'Image produit'}
                                                        width={64}
                                                        height={64}
                                                        className="w-16 h-16 object-cover rounded-md shadow-sm mx-auto"
                                                        onError={(e: React.SyntheticEvent<HTMLImageElement, Event>) => {
                                                            const target = e.target as HTMLImageElement;
                                                            target.onerror = null;
                                                            target.src = "https://placehold.co/64x64/cccccc/000000?text=No+Image";
                                                        }}
                                                    />
                                                ) : (
                                                    <Image
                                                        src="https://placehold.co/64x64/cccccc/000000?text=No+Image"
                                                        alt="No Image"
                                                        width={64}
                                                        height={64}
                                                        className="w-16 h-16 object-cover rounded-md shadow-sm mx-auto"
                                                    />
                                                )}
                                            </td>
                                            <td className="py-3 px-4 border-b border-gray-200 text-gray-800 text-center whitespace-nowrap">{product.name}</td>
                                            <td className="py-3 px-4 border-b border-gray-200 text-gray-800 text-center whitespace-nowrap">{product.stock}</td>
                                            <td className="py-3 px-4 border-b border-gray-200 text-gray-800 text-center whitespace-nowrap">{formatPrice(product.price)}</td>
                                            <td className="py-3 px-4 border-b border-gray-200 text-gray-800 text-center whitespace-nowrap">
                                                {formatPrice(product.price * product.stock)}
                                            </td>
                                            <td className="py-3 px-4 border-b border-gray-200 text-center whitespace-nowrap">
                                                <button
                                                    onClick={() => handleEditClick(product)}
                                                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg shadow-md transition-all duration-300 ease-in-out transform hover:scale-105"
                                                    aria-label={`Modifier le produit ${product.name}`}
                                                >
                                                    Modifier
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Modal d'édition */}
                {editingProduct && (
                    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50 p-4"
                        role='dialog'
                        aria-modal='true'
                        aria-labelledby='edit-product-title'
                    >
                        <div className="bg-white p-8 rounded-xl shadow-2xl w-full max-w-md transform transition-all duration-300 scale-100 opacity-100">
                            <h2 id='edit-product-title' className="text-2xl font-bold text-gray-800 mb-6 text-center">Modifier le Produit</h2>
                            <form onSubmit={handleFormSubmit}>
                                <div className="mb-4">
                                    <label htmlFor="editName" className="block text-gray-700 text-sm font-bold mb-2">Nom du Produit:</label>
                                    <input
                                        type="text"
                                        id="editName"
                                        name="name"
                                        value={editForm.name}
                                        onChange={handleFormChange}
                                        className="shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500"
                                        required
                                        aria-label="Nom du produit"
                                    />
                                </div>
                                <div className="mb-4">
                                    <label htmlFor="editDescription" className="block text-gray-700 text-sm font-bold mb-2">Description:</label>
                                    <textarea
                                        id="editDescription"
                                        name="description"
                                        value={editForm.description}
                                        onChange={handleFormChange}
                                        rows={3}
                                        className="shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500 h-24 resize-y"
                                        aria-label="Description du produit"
                                    ></textarea>
                                </div>
                                <div className="mb-4">
                                    <label htmlFor="editCategory" className="block text-gray-700 text-sm font-bold mb-2">Catégorie:</label>
                                    <input
                                        type="text"
                                        id="editCategory"
                                        name="category"
                                        value={editForm.category}
                                        onChange={handleFormChange}
                                        className="shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500"
                                        required
                                        aria-label="Catégorie du produit"
                                    />
                                </div>
                                <div className="mb-4">
                                    <label htmlFor="editPrice" className="block text-gray-700 text-sm font-bold mb-2">Prix:</label>
                                    <input
                                        type="number"
                                        id="editPrice"
                                        name="price"
                                        value={editForm.price}
                                        onChange={handleFormChange}
                                        className="shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500"
                                        required
                                        min="0"
                                        aria-label="Prix du produit"
                                    />
                                </div>
                                <div className="mb-4">
                                    <label htmlFor="editOfferPrice" className="block text-gray-700 text-sm font-bold mb-2">Prix Offre (Optionnel):</label>
                                    <input
                                        type="number"
                                        id="editOfferPrice"
                                        name="offerPrice"
                                        value={editForm.offerPrice}
                                        onChange={handleFormChange}
                                        className="shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500"
                                        min="0"
                                        aria-label="Prix promotionnel du produit (optionnel)"
                                    />
                                </div>
                                <div className="mb-4">
                                    <label htmlFor="editStock" className="block text-gray-700 text-sm font-bold mb-2">Quantité en Stock:</label>
                                    <input
                                        type="number"
                                        id="editStock"
                                        name="stock"
                                        value={editForm.stock}
                                        onChange={handleFormChange}
                                        className="shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500"
                                        required
                                        min="0"
                                        aria-label="Quantité en stock"
                                    />
                                </div>
                                <div className="mb-6">
                                    <label htmlFor="editImgUrl" className="block text-gray-700 text-sm font-bold mb-2">URL de l&#39;Image:</label>
                                    <input
                                        type="text"
                                        id="editImgUrl"
                                        name="imgUrl"
                                        value={editForm.imgUrl}
                                        onChange={handleFormChange}
                                        className="shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500"
                                        required
                                        aria-label="URL de l'image du produit"
                                    />
                                </div>
                                <div className="flex items-center justify-between">
                                    <button
                                        type="submit"
                                        className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg shadow-md transition-all duration-300 ease-in-out transform hover:scale-105"
                                        aria-label="Enregistrer les modifications du produit"
                                    >
                                        Enregistrer les modifications
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleCloseModal}
                                        className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg shadow-md transition-all duration-300 ease-in-out transform hover:scale-105"
                                        aria-label="Annuler les modifications et fermer"
                                    >
                                        Annuler
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default StockPage;
