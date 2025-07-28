// app/seller/orders/page.tsx
'use client';

import React, { useEffect, useState, useCallback, ChangeEvent } from "react";
import Image from "next/image";
import { useAppContext } from "@/context/AppContext";
import Footer from "@/components/seller/Footer";
import Loading from "@/components/Loading";
import axios from "axios";
import { Package, Trash2 } from "lucide-react";
import { useSession } from "next-auth/react";
import { toast } from "react-toastify";
import { useRouter } from "next/navigation";

import { Order, OrderStatus, PaymentStatus, UserRole } from "@/lib/types";

const getStatusBadgeStyle = (status: string): string => {
    switch (status) {
        case OrderStatus.DELIVERED:
        case PaymentStatus.COMPLETED:
            return 'bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs font-medium';
        case OrderStatus.PENDING:
        case OrderStatus.PROCESSING:
        case OrderStatus.ON_HOLD:
        case OrderStatus.SHIPPED:
            return 'bg-orange-100 text-orange-800 px-2 py-1 rounded-full text-xs font-medium';
        case OrderStatus.CANCELLED:
        case OrderStatus.PAYMENT_FAILED: // OrderStatus a PAYMENT_FAILED
        case PaymentStatus.FAILED: // PaymentStatus a FAILED
        case PaymentStatus.REFUNDED:
            return 'bg-red-100 text-red-800 px-2 py-1 rounded-full text-xs font-medium';
        default:
            return 'bg-gray-100 text-gray-800 px-2 py-1 rounded-full text-xs font-medium';
    }
};

const formatFullDateTime = (dateTimeValue: string | number | Date | null | undefined): string => {
    if (dateTimeValue === undefined || dateTimeValue === null) return "Date non disponible";

    let date: Date;

    if (dateTimeValue instanceof Date) {
        date = dateTimeValue;
    } else if (typeof dateTimeValue === 'string') {
        const numericTimestamp = parseInt(dateTimeValue, 10);
        if (!isNaN(numericTimestamp) && numericTimestamp > 0 && String(numericTimestamp) === dateTimeValue) {
            date = new Date(numericTimestamp < 1000000000000 ? numericTimestamp * 1000 : numericTimestamp);
        } else {
            date = new Date(dateTimeValue);
        }
    } else if (typeof dateTimeValue === 'number') {
        date = new Date(dateTimeValue < 1000000000000 && dateTimeValue > 0 ? dateTimeValue * 1000 : dateTimeValue);
    } else {
        return "Date invalide";
    }

    if (isNaN(date.getTime()) || (date.getFullYear() === 1970 && date.getMonth() === 0 && date.getDate() === 1 && date.getHours() === 0 && date.getMinutes() === 0)) {
        console.warn("Date parsed as invalid or epoch (1970-01-01):", dateTimeValue);
        return "Date non disponible";
    }

    return date.toLocaleString('fr-FR', {
        year: 'numeric', month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit',
        hour12: false,
    });
};

const Orders = (): React.ReactElement => {
    const { formatPrice } = useAppContext();
    const { data: session, status } = useSession();
    const router = useRouter();

    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [showConfirmModal, setShowConfirmModal] = useState<boolean>(false);
    const [orderToDelete, setOrderToDelete] = useState<string | null>(null);

    const fetchAllOrders = useCallback(async () => {
        if (status !== 'authenticated' || session?.user?.role !== UserRole.ADMIN) {
            setLoading(false);
            setError('Accès refusé. Vous devez être connecté en tant qu\'administrateur.');
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const response = await axios.get<Order[]>('/api/admin/orders', {
                headers: {
                    'auth-token': session.user.token,
                },
            });

            if (Array.isArray(response.data)) {
                const fetchedOrders = response.data.map(order => ({
                    ...order,
                    orderItems: order.orderItems.map(item => ({
                        ...item,
                        product: {
                            ...item.product,
                            imgUrl: Array.isArray(item.product.imgUrl)
                                ? item.product.imgUrl
                                : (item.product.imgUrl ? [item.product.imgUrl] : []),
                        }
                    }))
                }));
                setOrders(fetchedOrders);
            } else {
                setError('Format de données inattendu de l\'API.');
            }
        } catch (err: unknown) {
            console.error('Erreur lors du chargement des commandes:', err);
            if (axios.isAxiosError(err)) {
                setError(err.response?.data?.message || 'Erreur lors du chargement des commandes.');
            } else {
                setError('Erreur réseau ou inconnue lors du chargement des commandes.');
            }
        } finally {
            setLoading(false);
        }
    }, [status, session?.user?.token, session?.user?.role]);


    const handleStatusChange = async (event: ChangeEvent<HTMLSelectElement>, orderId: string) => {
        const newStatus = event.target.value as OrderStatus;
        if (!session?.user?.token) {
            toast.error("Authentification requise pour mettre à jour le statut.");
            router.push('/login');
            return;
        }
        try {
            const response = await axios.put(`/api/admin/orders/${orderId}`, { status: newStatus }, {
                headers: {
                    'Content-Type': 'application/json',
                    'auth-token': session.user.token,
                },
            });

            if (response.data.success) {
                setOrders(prevOrders =>
                    prevOrders.map(order =>
                        order.id === orderId ? { ...order, status: newStatus } : order
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

    const handleDeleteClick = (orderId: string) => {
        setOrderToDelete(orderId);
        setShowConfirmModal(true);
    };

    const confirmDelete = async () => {
        setShowConfirmModal(false);
        if (!orderToDelete) return;

        if (!session?.user?.token) {
            toast.error("Authentification requise pour supprimer un produit.");
            router.push('/login');
            return;
        }

        try {
            const response = await axios.delete(`/api/admin/orders/${orderToDelete}`, {
                headers: {
                    'auth-token': session.user.token,
                },
                data: { id: orderToDelete }
            });
            if (response.data.success) {
                setOrders(prevOrders => prevOrders.filter(order => order.id !== orderToDelete));
                toast.success('Commande supprimée avec succès !');
                // Optionally, refetch all orders to ensure the list is fully up-to-date
                // fetchAllOrders();
            } else {
                toast.error('Échec de la suppression de la commande.');
            }
        } catch (error: unknown) {
            console.error('Erreur lors de la suppression de la commande:', error);
            toast.error('Erreur réseau ou du serveur lors de la suppression de la commande.');
        } finally {
            setOrderToDelete(null);
        }
    };

    const cancelDelete = () => {
        setShowConfirmModal(false);
        setOrderToDelete(null);
    };

    useEffect(() => {
        if (status === 'authenticated' && session?.user?.role === UserRole.ADMIN) {
            fetchAllOrders();
        } else if (status === 'unauthenticated') {
            setLoading(false);
            setError('Non connecté. Veuillez vous connecter.');
            router.push('/login');
        } else if (status === 'authenticated' && session?.user?.role !== UserRole.ADMIN) {
            setLoading(false);
            setError('Accès refusé. Vous n\'êtes pas autorisé à voir cette page.');
            router.push('/');
        }
    }, [status, fetchAllOrders, session?.user?.role, router]);

    return (
        <div className="flex flex-col min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-100 font-sans">
            <main className="flex-1 p-4 md:p-8 lg:p-10 max-w-7xl mx-auto w-full">
                <div className="flex items-center gap-4 mb-8">
                    <Package className="w-10 h-10 text-blue-600" aria-hidden='true' />
                    <h1 className="text-4xl font-extrabold text-gray-900">Gestion des Commandes</h1>
                </div>

                {loading ? (
                    <div className="flex justify-center items-center h-64 bg-white rounded-xl shadow">
                        <Loading />
                        <p className="ml-3 text-lg text-gray-700">Chargement des commandes...</p>
                    </div>
                ) : error ? (
                    <div className="text-center bg-red-100 border border-red-300 text-red-800 p-6 rounded-xl shadow-md" role='alert'>
                        <h2 className="text-xl font-bold mb-3">Erreur</h2>
                        <p>{error}</p>
                        <button
                            onClick={() => router.push('/login')}
                            className="mt-4 px-6 py-3 bg-blue-600 text-white rounded-lg shadow hover:bg-blue-700 transition-transform duration-300 transform hover:scale-105"
                            aria-label='Se connecter pour accéder aux commandes'
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
                                        {orders.map((order: Order) => (
                                            <tr key={order.id} className="hover:bg-blue-50 transition duration-150">
                                                <td className="py-4 px-6">
                                                    <p className="font-semibold text-gray-800">{order.userName || 'N/A'}</p>
                                                    <p className="text-gray-600">{order.userEmail || 'N/A'}</p>
                                                </td>
                                                <td className="py-4 px-6">
                                                    <div className="flex flex-col space-y-2">
                                                        {order.orderItems?.length > 0 ? (
                                                            order.orderItems.map((item, index) => (
                                                                <div key={index} className="flex items-center gap-2">
                                                                    {Array.isArray(item.product.imgUrl) && item.product.imgUrl.length > 0 && item.product.imgUrl[0] ? (
                                                                        <Image
                                                                            src={item.product.imgUrl[0]}
                                                                            alt={item.product.name || 'Image produit'}
                                                                            width={30}
                                                                            height={30}
                                                                            className="rounded object-cover"
                                                                            onError={(e: React.SyntheticEvent<HTMLImageElement, Event>) => { e.currentTarget.src = '/placeholder.jpg'; }}
                                                                        />
                                                                    ) : (
                                                                        <div className="w-8 h-8 bg-gray-200 rounded-md flex items-center justify-center text-gray-500 text-xs">
                                                                            <Package size={16} />
                                                                        </div>
                                                                    )}
                                                                    <span className="text-gray-700">{item.product.name} x {item.quantity}</span>
                                                                </div>
                                                            ))
                                                        ) : (
                                                            <span className="text-gray-500">Aucun</span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="py-4 px-6 font-bold text-gray-900">{formatPrice(order.totalAmount)}</td>
                                                <td className="py-4 px-6 text-gray-700">
                                                    <p>{order.shippingAddressLine1}</p>
                                                    {order.shippingAddressLine2 && <p>{order.shippingAddressLine2}</p>}
                                                    <p>{`${order.shippingCity || ''}, ${order.shippingState || ''}`}</p>
                                                    <p>{`${order.shippingZipCode || ''}, ${order.shippingCountry || ''}`}</p>
                                                    {order.userPhoneNumber && <p className="font-medium">Tél: {order.userPhoneNumber}</p>}
                                                    {!order.userPhoneNumber && <p className="font-medium text-gray-500">Tél: N/A</p>}
                                                </td>
                                                <td className="py-4 px-6 text-gray-700">
                                                    <p className="font-medium">Méthode : {order.paymentMethod}</p>
                                                    <p>Statut :
                                                        <span className={`ml-1 px-2 py-1 rounded-full text-xs font-semibold ${getStatusBadgeStyle(order.paymentStatus)}`}>
                                                            {order.paymentStatus?.replace(/_/g, ' ') || 'N/A'}
                                                        </span>
                                                    </p>
                                                    <p className="font-mono text-xs">ID: {order.transactionId || 'N/A'}</p>
                                                </td>
                                                <td className="py-4 px-6 text-gray-700 whitespace-nowrap">
                                                    {formatFullDateTime(order.orderDate)}
                                                    </td>
                                                    <td className="py-4 px-6">
                                                        <select
                                                            onChange={(e) => handleStatusChange(e, order.id)}
                                                            value={order.status}
                                                            className={`p-2 rounded-md border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 ${getStatusBadgeStyle(order.status)}`}
                                                            aria-label={`Changer le statut de la commande ${order.id}`}
                                                        >
                                                            {/* MODIFICATION ICI : Limiter les options */}
                                                            <option value={OrderStatus.PENDING}>En attente</option>
                                                            <option value={OrderStatus.DELIVERED}>Livré</option>
                                                            {/* Si vous voulez d'autres options pour l'admin, ajoutez-les ici */}
                                                            {/* Par exemple, pour permettre de passer en 'PROCESSING' ou 'SHIPPED' */}
                                                            {/* <option value={OrderStatus.PROCESSING}>En cours de traitement</option> */}
                                                            {/* <option value={OrderStatus.SHIPPED}>Expédiée</option> */}
                                                        </select>
                                                    </td>
                                                    <td className="py-4 px-6 text-left">
                                                        <button
                                                            onClick={() => handleDeleteClick(order.id)}
                                                            className="text-red-600 hover:text-red-800 transition-colors duration-200"
                                                            title="Supprimer la commande"
                                                            aria-label={`Supprimer la commande ${order.id}`}
                                                        >
                                                            <Trash2 className="w-5 h-5" aria-hidden='true' />
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
                            role='dialog'
                            aria-modal='true'
                            aria-labelledby='confirm-delete-title'
                            aria-describedby='confirm-delete-description'
                        >
                            <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full text-center">
                                <h3 id='confirm-delete-title' className="text-2xl font-bold text-gray-900 mb-4">Confirmer la suppression</h3>
                                <p id='confirm-delete-description' className="text-gray-700 mb-6">Êtes-vous sûr de vouloir supprimer cette commande ? Cette action est irréversible.</p>
                                <div className="flex justify-center gap-4">
                                    <button
                                        onClick={cancelDelete}
                                        className="px-6 py-3 bg-gray-300 text-gray-800 rounded-lg shadow hover:bg-gray-400 transition-transform duration-300 transform hover:scale-105"
                                        aria-label='Annuler la suppression de la commande'
                                    >
                                        Annuler
                                    </button>
                                    <button
                                        onClick={confirmDelete}
                                        className="px-6 py-3 bg-red-600 text-white rounded-lg shadow hover:bg-red-700 transition-transform duration-300 transform hover:scale-105"
                                        aria-label='Confirmer la suppression de la commande'
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
    