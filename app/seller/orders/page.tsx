'use client';
import React, { useEffect, useState, useCallback, ChangeEvent } from 'react';
import Image from 'next/image';
import { useAppContext } from '@/context/AppContext'; // Assurez-vous que le contexte est bien typé
import Footer from '@/components/seller/Footer';
import Loading from '@/components/Loading';
import axios from 'axios';
import { Package, Trash2 } from 'lucide-react'; // Import Trash2 icon
import { useSession } from 'next-auth/react';
import { toast } from 'react-toastify'; // Import toast for notifications
import router from 'next/router';

// --- Interfaces de données pour les commandes ---

/**
 * @interface OrderItem Représente un article individuel dans une commande.
 */
interface OrderItem {
    name: string;
    quantity: number;
    imgUrl?: string; // URL de l'image, optionnel
}

/**
 * @interface Order Représente une commande complète.
 */
interface Order {
    id: string;
    userName: string;
    userEmail: string;
    items: OrderItem[];
    totalAmount: number;
    shippingAddressLine1: string;
    shippingAddressLine2?: string; // Optionnel
    shippingCity: string;
    shippingState: string;
    shippingZipCode: string;
    shippingCountry: string;
    shippingPhoneNumber?: string; // Optionnel
    paymentMethod: string;
    paymentStatusDetail: string;
    paymentTransactionId?: string; // Optionnel
    orderDate: string; // Ou Date si vous le convertissez en objet Date
    orderStatus: 'PENDING' | 'DELIVERED' | 'PROCESSING' | 'ON_HOLD' | 'COMPLETED' | 'CANCELLED' | 'REFUNDED' | 'FAILED' | 'SHIPPED'; // Ajoutez tous les statuts possibles
}

// --- Fonctions utilitaires ---

/**
 * Retourne les classes de style Tailwind CSS pour le badge de statut.
 * @param {string} status Le statut de la commande ou du paiement.
 * @returns {string} Les classes CSS.
 */
const getStatusBadgeStyle = (status: string): string => {
    switch (status) {
        case 'DELIVERED':
        case 'COMPLETED':
            return 'bg-green-100 text-green-800';
        case 'PENDING':
        case 'PROCESSING':
        case 'ON_HOLD':
        case 'SHIPPED':
            return 'bg-orange-100 text-orange-800';
        case 'CANCELLED':
        case 'FAILED':
        case 'REFUNDED': // Ajouté pour couvrir le statut de remboursement si applicable
            return 'bg-red-100 text-red-800';
        default:
            return 'bg-gray-100 text-gray-800';
    }
};

// --- Composant principal Orders ---

/**
 * Composant de la page de gestion des commandes pour le vendeur.
 * Affiche une liste des commandes, permet de changer leur statut et de les supprimer.
 * @returns {React.ReactElement} Le JSX de la page de gestion des commandes.
 */
const Orders = (): React.ReactElement => {
    // Utilisation du contexte global, assurez-vous que AppContext fournit les types corrects
    const { url, formatPrice } = useAppContext();
    const { status } = useSession(); // 'status' est le statut de la session NextAuth

    // États du composant
    const [orders, setOrders] = useState<Order[]>([]); // Type pour le tableau de commandes
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null); // Type pour l'erreur
    const [showConfirmModal, setShowConfirmModal] = useState<boolean>(false);
    const [orderToDelete, setOrderToDelete] = useState<string | null>(null); // Stocke l'ID de la commande à supprimer

    /**
     * Récupère toutes les commandes depuis l'API.
     * Utilise `useCallback` pour éviter des recréations inutiles de la fonction.
     */
    const fetchAllOrders = useCallback(async () => {
        if (status !== 'authenticated') {
            setLoading(false);
            setError('Vous devez être connecté pour voir les commandes.');
            return;
        }

        setLoading(true); // Mettre à jour l'état de chargement au début du fetch
        setError(null); // Réinitialiser l'erreur

        try {
            const response = await axios.get<Order[]>(`${url}/api/admin/orders`); // Type la réponse d'Axios
            if (response.status === 200 && Array.isArray(response.data)) {
                setOrders(response.data);
            } else {
                setError('Format de données inattendu.');
            }
        } catch (err: unknown) { // Type l'erreur comme 'unknown'
            console.error('Erreur lors du chargement des commandes:', err);
            if (axios.isAxiosError(err)) { // Vérifie si c'est une erreur Axios
                setError(err.response?.data?.message || 'Erreur lors du chargement des commandes.');
            } else {
                setError('Erreur réseau ou inconnue lors du chargement des commandes.');
            }
        } finally {
            setLoading(false);
        }
    }, [url, status]); // Dépendances de useCallback

    /**
     * Gère le changement de statut d'une commande.
     * @param {ChangeEvent<HTMLSelectElement>} event L'événement de changement de la sélection.
     * @param {string} orderId L'ID de la commande à mettre à jour.
     */
    const handleStatusChange = async (event: ChangeEvent<HTMLSelectElement>, orderId: string) => {
        const newStatus = event.target.value as Order['orderStatus']; // Assurez le type correct pour newStatus
        try {
            const response = await axios.post(`${url}/api/admin/order-status`, {
                orderId,
                status: newStatus,
            });

            if (response.data.success) {
                // Met à jour la commande dans l'état local pour refléter le changement
                setOrders(prevOrders =>
                    prevOrders.map(order =>
                        order.id === orderId ? { ...order, orderStatus: newStatus } : order
                    )
                );
                toast.success('Statut de la commande mis à jour avec succès !');
            } else {
                toast.error('Échec de la mise à jour du statut de la commande.');
            }
        } catch (error: unknown) {
            console.error('Erreur lors de la mise à jour du statut:', error);
            toast.error('Erreur réseau ou du serveur lors de la mise à jour du statut.');
        }
    };

    /**
     * Ouvre la modale de confirmation de suppression.
     * @param {string} orderId L'ID de la commande à supprimer.
     */
    const handleDeleteClick = (orderId: string) => {
        setOrderToDelete(orderId);
        setShowConfirmModal(true);
    };

    /**
     * Confirme et exécute la suppression d'une commande.
     */
    const confirmDelete = async () => {
        setShowConfirmModal(false); // Ferme la modale
        if (!orderToDelete) return; // S'assure qu'un ID est défini

        try {
            const response = await axios.delete(`${url}/api/admin/orders/${orderToDelete}`); // Utilisation de la méthode DELETE
            if (response.data.success) {
                setOrders(prevOrders => prevOrders.filter(order => order.id !== orderToDelete));
                toast.success('Commande supprimée avec succès !');
            } else {
                toast.error('Échec de la suppression de la commande.');
            }
        } catch (error: unknown) {
            console.error('Erreur lors de la suppression de la commande:', error);
            toast.error('Erreur réseau ou du serveur lors de la suppression de la commande.');
        } finally {
            setOrderToDelete(null); // Réinitialise l'ID de la commande à supprimer
        }
    };

    /**
     * Annule l'opération de suppression et ferme la modale.
     */
    const cancelDelete = () => {
        setShowConfirmModal(false);
        setOrderToDelete(null);
    };

    // Effet pour charger les commandes lors de l'authentification
    useEffect(() => {
        if (status === 'authenticated') {
            fetchAllOrders();
        } else if (status === 'unauthenticated') {
            setLoading(false);
            setError('Non connecté. Veuillez vous connecter.');
        }
    }, [status, fetchAllOrders]); // fetchAllOrders est une dépendance stable grâce à useCallback

    /**
     * Formate un timestamp en date et heure complètes.
     * @param {string | number | Date | null | undefined} timestamp Le timestamp à formater.
     * @returns {string} La date et l'heure formatées ou "N/A".
     */
    const formatFullDateTime = (timestamp: string | number | Date | null | undefined): string => {
        if (!timestamp) return 'N/A';
        const date = new Date(timestamp);
        // Vérifie si la date est valide
        if (isNaN(date.getTime())) return 'Date invalide';
        return date.toLocaleString('fr-FR', {
            year: 'numeric', month: 'short', day: 'numeric',
            hour: '2-digit', minute: '2-digit',
            hour12: false,
        });
    };

    return (
        <div className="flex flex-col min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-100 font-inter">
            <main className="flex-1 p-4 md:p-8 lg:p-10 max-w-7xl mx-auto w-full">
                <div className="flex items-center gap-4 mb-8">
                    <Package className="w-10 h-10 text-blue-600" aria-hidden='true' /> {/* Icône décorative */}
                    <h1 className="text-4xl font-extrabold text-gray-900">Gestion des Commandes</h1>
                </div>

                {loading ? (
                    <div className="flex justify-center items-center h-64 bg-white rounded-xl shadow">
                        <Loading />
                    </div>
                ) : error ? (
                    <div className="text-center bg-red-100 border border-red-300 text-red-800 p-6 rounded-xl shadow-md" role='alert'>
                        <h2 className="text-xl font-bold mb-3">Erreur</h2>
                        <p>{error}</p>
                        <button
                            onClick={() => router.push('/login')} // Utilisation de router.push pour la navigation Next.js
                            className="mt-4 px-6 py-3 bg-blue-600 text-white rounded-lg shadow hover:bg-blue-700 transition-transform duration-300 transform hover:scale-105"
                            aria-label='Se connecter pour accéder aux commandes' // Ajouté pour l'accessibilité
                        >
                            Se connecter
                        </button>
                    </div>
                ) : (
                    <div className="bg-white rounded-xl shadow border border-gray-200 overflow-hidden">
                        <div className="p-6 border-b border-gray-200 bg-gray-50">
                            <h2 className="text-2xl font-semibold text-gray-800">Toutes les Commandes Clients</h2>
                        </div>

                        {orders.length === 0 ? (
                            <p className="text-gray-600 text-center p-10">Aucune commande trouvée.</p>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-gray-200 text-sm">
                                    <thead className="bg-gray-100">
                                        <tr>
                                            <th scope="col" className="py-4 px-6 text-left font-medium text-gray-600 uppercase tracking-wider">Client</th>
                                            <th scope="col" className="py-4 px-6 text-left font-medium text-gray-600 uppercase tracking-wider">Articles</th>
                                            <th scope="col" className="py-4 px-6 text-left font-medium text-gray-600 uppercase tracking-wider">Total</th>
                                            <th scope="col" className="py-4 px-6 text-left font-medium text-gray-600 uppercase tracking-wider">Livraison</th>
                                            <th scope="col" className="py-4 px-6 text-left font-medium text-gray-600 uppercase tracking-wider">Paiement</th>
                                            <th scope="col" className="py-4 px-6 text-left font-medium text-gray-600 uppercase tracking-wider">Date</th>
                                            <th scope="col" className="py-4 px-6 text-left font-medium text-gray-600 uppercase tracking-wider">Statut Commande</th>
                                            <th scope="col" className="py-4 px-6 text-left font-medium text-gray-600 uppercase tracking-wider">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {orders.map((order: Order) => ( // Type 'order' comme Order
                                            <tr key={order.id} className="hover:bg-blue-50 transition duration-150">
                                                <td className="py-4 px-6">
                                                    <p className="font-semibold text-gray-800">{order.userName || 'N/A'}</p>
                                                    <p className="text-gray-600">{order.userEmail || 'N/A'}</p>
                                                </td>
                                                <td className="py-4 px-6">
                                                    {order.items?.length > 0 ? (
                                                        <ul className="space-y-1">
                                                            {order.items.map((item: OrderItem, index: number) => ( // Type 'item' comme OrderItem
                                                                <li key={index} className="flex items-center gap-2">
                                                                    {item.imgUrl && (
                                                                        <Image
                                                                            src={item.imgUrl}
                                                                            alt={item.name || 'Image produit'}
                                                                            width={30}
                                                                            height={30}
                                                                            className="rounded object-cover"
                                                                        />
                                                                    )}
                                                                    <span className="text-gray-700">{item.name} x {item.quantity}</span>
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    ) : (
                                                        <span className="text-gray-500">Aucun</span>
                                                    )}
                                                </td>
                                                <td className="py-4 px-6 font-bold text-gray-900">{formatPrice(order.totalAmount)}</td>
                                                <td className="py-4 px-6 text-gray-700">
                                                    <p>{order.shippingAddressLine1}</p>
                                                    {order.shippingAddressLine2 && <p>{order.shippingAddressLine2}</p>}
                                                    <p>{`${order.shippingCity || ''}, ${order.shippingState || ''}`}</p>
                                                    <p>{`${order.shippingZipCode || ''}, ${order.shippingCountry || ''}`}</p>
                                                    {order.shippingPhoneNumber && <p className="font-medium">Tél: {order.shippingPhoneNumber}</p>}
                                                    {!order.shippingPhoneNumber && <p className="font-medium text-gray-500">Tél: N/A</p>}
                                                </td>
                                                <td className="py-4 px-6 text-gray-700">
                                                    <p className="font-medium">Méthode : {order.paymentMethod}</p>
                                                    <p>Statut :
                                                        <span className={`ml-1 px-2 py-1 rounded-full text-xs font-semibold ${getStatusBadgeStyle(order.paymentStatusDetail)}`}>
                                                            {order.paymentStatusDetail?.replace(/_/g, ' ') || 'N/A'}
                                                        </span>
                                                    </p>
                                                    <p className="font-mono text-xs">ID: {order.paymentTransactionId || 'N/A'}</p>
                                                </td>
                                                <td className="py-4 px-6 text-gray-700 whitespace-nowrap">
                                                    {formatFullDateTime(order.orderDate)}
                                                </td>
                                                {/* Status Dropdown */}
                                                <td className="py-4 px-6">
                                                    <select
                                                        onChange={(e) => handleStatusChange(e, order.id)}
                                                        value={order.orderStatus}
                                                        className={`p-2 rounded-md border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 ${getStatusBadgeStyle(order.orderStatus)}`}
                                                        aria-label={`Changer le statut de la commande ${order.id}`} // Ajouté pour l'accessibilité
                                                    >
                                                        <option value="PENDING">En attente</option>
                                                        <option value="PROCESSING">En traitement</option>
                                                        <option value="SHIPPED">Expédiée</option>
                                                        <option value="DELIVERED">Livrée</option>
                                                        <option value="CANCELLED">Annulée</option>
                                                    </select>
                                                </td>
                                                {/* Actions column with Delete button */}
                                                <td className="py-4 px-6 text-left">
                                                    <button
                                                        onClick={() => handleDeleteClick(order.id)}
                                                        className="text-red-600 hover:text-red-800 transition-colors duration-200"
                                                        title="Supprimer la commande"
                                                        aria-label={`Supprimer la commande ${order.id}`} // Ajouté pour l'accessibilité
                                                    >
                                                        <Trash2 className="w-5 h-5" aria-hidden='true' /> {/* Icône décorative */}
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}

                {/* Confirmation Modal for Deletion */}
                {showConfirmModal && (
                    <div
                        className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
                        role='dialog' // Indique que c'est une boîte de dialogue
                        aria-modal='true' // Indique qu'il s'agit d'une modale
                        aria-labelledby='confirm-delete-title' // Référence le titre de la modale
                        aria-describedby='confirm-delete-description' // Référence la description
                    >
                        <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full text-center">
                            <h3 id='confirm-delete-title' className="text-2xl font-bold text-gray-900 mb-4">Confirmer la suppression</h3>
                            <p id='confirm-delete-description' className="text-gray-700 mb-6">Êtes-vous sûr de vouloir supprimer cette commande ? Cette action est irréversible.</p>
                            <div className="flex justify-center gap-4">
                                <button
                                    onClick={cancelDelete}
                                    className="px-6 py-3 bg-gray-300 text-gray-800 rounded-lg shadow hover:bg-gray-400 transition-transform duration-300 transform hover:scale-105"
                                    aria-label='Annuler la suppression de la commande' // Ajouté pour l'accessibilité
                                >
                                    Annuler
                                </button>
                                <button
                                    onClick={confirmDelete}
                                    className="px-6 py-3 bg-red-600 text-white rounded-lg shadow hover:bg-red-700 transition-transform duration-300 transform hover:scale-105"
                                    aria-label='Confirmer la suppression de la commande' // Ajouté pour l'accessibilité
                                >
                                    Supprimer
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </main>
            <Footer />
        </div>
    );
};

export default Orders;
