// app/my-orders/page.tsx
'use client';

import React, { useEffect, useState } from 'react';
import { useAppContext } from '@/context/AppContext';
import { OrderStatus, PaymentStatus } from '@/lib/types';
import Footer from "@/components/Footer";
import Loading from "@/components/Loading";
import Image from 'next/image'; // Réintroduire l'importation de Image
import { ShoppingCart, Package, ChevronDown, ChevronUp } from 'lucide-react'; // Icônes

const MyOrdersPage = () => {
    const { userOrders, loadingOrders, errorFetchingOrders, fetchUserOrders, formatPrice, isLoggedIn, currentUser } = useAppContext();
    const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);

    useEffect(() => {
        if (isLoggedIn && currentUser?.id) {
            console.log("MyOrdersPage component: User is logged in and currentUser.id is available, fetching orders.");
            fetchUserOrders();
        } else if (!isLoggedIn) {
            console.log("MyOrdersPage component: User is not logged in, not fetching orders.");
        }
    }, [isLoggedIn, currentUser?.id, fetchUserOrders]);

    const toggleExpand = (orderId: string) => {
        setExpandedOrderId(prevId => (prevId === orderId ? null : orderId));
    };

    const getStatusBadgeStyle = (status: OrderStatus | PaymentStatus | null) => {
        if (!status) return 'bg-gray-200 text-gray-800 px-3 py-1.5 rounded-full text-sm font-semibold shadow-sm';

        switch (status) {
            case OrderStatus.DELIVERED:
            case PaymentStatus.COMPLETED:
                return 'bg-green-600 text-white px-3 py-1.5 rounded-full text-sm font-semibold shadow-md';
            case OrderStatus.SHIPPED:
            case OrderStatus.PROCESSING:
                return 'bg-blue-600 text-white px-3 py-1.5 rounded-full text-sm font-semibold shadow-md';
            case OrderStatus.PENDING:
            case PaymentStatus.PENDING:
                return 'bg-yellow-500 text-white px-3 py-1.5 rounded-full text-sm font-semibold shadow-md';
            case OrderStatus.CANCELLED:
            case OrderStatus.PAYMENT_FAILED:
            case PaymentStatus.FAILED:
                return 'bg-red-600 text-white px-3 py-1.5 rounded-full text-sm font-semibold shadow-md';
            default:
                return 'bg-gray-200 text-gray-800 px-3 py-1.5 rounded-full text-sm font-semibold shadow-sm';
        }
    };

    const formatFullDateTime = (dateTimeValue: Date | string | number | undefined | null): string => {
        if (dateTimeValue === undefined || dateTimeValue === null) return "Date non disponible";

        let date: Date;

        // Tente de créer une date directement. Cela fonctionne pour les chaînes ISO 8601 et les objets Date.
        try {
            date = new Date(dateTimeValue);
        } catch (e) {
            console.error("Erreur lors de la tentative de création de date:", dateTimeValue, e);
            return "Date invalide";
        }

        // Si la date est invalide (par exemple, si la chaîne n'était pas un format valide)
        // ou si c'est une date epoch (1970-01-01) qui indique souvent un problème de parsing
        if (isNaN(date.getTime()) || (date.getFullYear() === 1970 && date.getMonth() === 0 && date.getDate() === 1 && date.getHours() === 0 && date.getMinutes() === 0 && date.getSeconds() === 0)) {
            console.warn("Date parsed as invalid or epoch (1970-01-01):", dateTimeValue);
            return "Date non disponible";
        }

        // Utilise toLocaleString pour un formatage lisible
        return date.toLocaleString('fr-FR', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false // Format 24 heures
        });
    };


    if (loadingOrders) {
        return (
            <div className="flex justify-center items-center min-h-[60vh] bg-gray-50">
                <Loading />
                <p className="ml-3 text-lg text-gray-700">Chargement de vos commandes...</p>
            </div>
        );
    }

    if (errorFetchingOrders) {
        return (
            <div className="text-center p-8 min-h-[60vh] flex flex-col justify-center items-center bg-gray-50">
                <h1 className="text-3xl font-bold text-red-600 mb-4">Erreur de chargement des commandes</h1>
                <p className="text-lg text-gray-700">
                    Désolé, une erreur est survenue lors de la récupération de vos commandes: <span className="font-mono text-red-700">{errorFetchingOrders}</span>
                </p>
                <p className="text-md text-gray-600 mt-2">Veuillez réessayer plus tard.</p>
            </div>
        );
    }

    if (!isLoggedIn) {
        return (
            <div className="text-center p-8 min-h-[60vh] flex flex-col justify-center items-center bg-gray-50">
                <h1 className="text-3xl font-bold text-gray-800 mb-4">Accès refusé</h1>
                <p className="text-lg text-gray-700">
                    Veuillez vous connecter pour consulter l&#39;historique de vos commandes.
                </p>
                <button
                    onClick={() => window.location.href = '/login'}
                    className="mt-6 px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold shadow-md hover:bg-blue-700 transition transform hover:scale-105"
                >
                    Se connecter
                </button>
            </div>
        );
    }

    if (!userOrders || userOrders.length === 0) {
        return (
            <div className="text-center p-8 min-h-[60vh] flex flex-col justify-center items-center bg-gray-50">
                <h1 className="text-3xl font-bold text-gray-800 mb-4">Aucune commande trouvée</h1>
                <p className="text-lg text-gray-700">
                    Vous n&#39;avez pas encore passé de commande. Explorez nos produits et commencez vos achats !
                </p>
                <button
                    onClick={() => window.location.href = '/'}
                    className="mt-6 px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold shadow-md hover:bg-blue-700 transition transform hover:scale-105"
                >
                    Commencer vos achats
                </button>
            </div>
        );
    }

    return (
        <>
            <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-100 py-10 px-4 md:px-8 font-sans">
                <h1 className="text-5xl font-extrabold text-gray-900 mb-12 text-center drop-shadow-sm">Mes Commandes</h1>

                <div className="max-w-7xl mx-auto space-y-6">
                    {userOrders.map((order) => {
                        const isExpanded = expandedOrderId === order.id;
                        return (
                            <div key={order.id} className="bg-white rounded-3xl shadow-2xl border border-gray-100 overflow-hidden transform transition-all duration-300 hover:scale-[1.005]">
                                {/* En-tête de la commande - Ligne horizontale cliquable */}
                                <div
                                    className="bg-gradient-to-r from-blue-700 to-indigo-800 p-6 text-white flex flex-col sm:flex-row justify-between items-center gap-6 cursor-pointer"
                                    onClick={() => toggleExpand(order.id)}
                                >
                                    {/* Section Gauche: Icône de commande, ID, Date */}
                                    <div className="flex items-center gap-4 flex-1">
                                        <ShoppingCart className="w-10 h-10 text-white drop-shadow-lg" />
                                        <div>
                                            <h2 className="text-3xl font-bold">Commande #{order.id.substring(0, 8)}...</h2>
                                            <p className="text-sm opacity-90 mt-1">
                                                <span className="font-semibold">Date:</span> {formatFullDateTime(order.orderDate)}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Section Droite: Total, Statuts, Icône de dépliage */}
                                    <div className="flex items-center gap-6">
                                        <div className="text-center">
                                            <p className="text-lg font-bold">Total</p>
                                            <p className="text-xl font-extrabold">{formatPrice(order.totalAmount)}</p>
                                        </div>
                                        <div className="text-center">
                                            <p className="text-lg font-bold">Statut</p>
                                            <span className={`mt-1 inline-block ${getStatusBadgeStyle(order.status)}`}>
                                                {order.status}
                                            </span>
                                        </div>
                                        <div className="text-center">
                                            <p className="text-lg font-bold">Paiement</p>
                                            <span className={`mt-1 inline-block ${getStatusBadgeStyle(order.paymentStatus)}`}>
                                                {order.paymentStatus}
                                            </span>
                                        </div>
                                        {isExpanded ? (
                                            <ChevronUp className="w-6 h-6 ml-4 transition-transform duration-300" />
                                        ) : (
                                            <ChevronDown className="w-6 h-6 ml-4 transition-transform duration-300" />
                                        )}
                                    </div>
                                </div>

                                {/* Contenu dépliable */}
                                <div
                                    className={`grid transition-all duration-500 ease-in-out ${
                                        isExpanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
                                    }`}
                                >
                                    <div className="overflow-hidden">
                                        <div className="p-8 border-b border-gray-100">
                                            <h3 className="text-xl font-bold text-gray-800 mb-6 border-b-2 pb-2 border-blue-200">Articles commandés</h3>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                                                {order.orderItems.map((item, itemIndex) => (
                                                    <div key={itemIndex} className="flex items-center space-x-4 bg-gray-50 p-4 rounded-xl shadow-sm border border-gray-100">
                                                        {/* Affichage de l'image du produit ou de l'icône de remplacement */}
                                                        {Array.isArray(item.product.imgUrl) && item.product.imgUrl.length > 0 && item.product.imgUrl[0] ? (
                                                            <Image
                                                                src={item.product.imgUrl[0]}
                                                                alt={item.product.name}
                                                                width={64}
                                                                height={64}
                                                                className="w-16 h-16 object-cover rounded-lg shadow-inner flex-shrink-0"
                                                                // Fallback si l'image Cloudinary ne se charge pas
                                                                onError={(e: React.SyntheticEvent<HTMLImageElement, Event>) => {
                                                                    e.currentTarget.style.display = 'none'; // Cache l'image cassée
                                                                    const parent = e.currentTarget.parentElement;
                                                                    if (parent) {
                                                                        const iconDiv = document.createElement('div');
                                                                        iconDiv.className = 'w-16 h-16 flex items-center justify-center bg-blue-100 rounded-lg shadow-inner flex-shrink-0';
                                                                        iconDiv.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-package text-blue-600"><path d="m7.5 4.27v-2.4c0-1.1.9-2 2-2h3.5c1.1 0 2 .9 2 2v2.4"/><path d="M4.5 9.5v11.3c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V9.5"/><path d="M12 2v20"/><path d="M18.5 4.27a2 2 0 0 1 1.43 2.5l-4.27 12.59a2 2 0 0 1-3.26.85L6 11"/><path d="M5.5 4.27a2 2 0 0 0-1.43 2.5l4.27 12.59a2 2 0 0 0 3.26.85L18 11"/></svg>`;
                                                                        parent.appendChild(iconDiv);
                                                                    }
                                                                }}
                                                            />
                                                        ) : (
                                                            <div className="w-16 h-16 flex items-center justify-center bg-blue-100 rounded-lg shadow-inner flex-shrink-0">
                                                                <Package className="w-9 h-9 text-blue-600" />
                                                            </div>
                                                        )}
                                                        <div className="flex-1">
                                                            <p className="text-gray-900 font-semibold text-lg">{item.product.name}</p>
                                                            <p className="text-sm text-gray-600 mt-1">Quantité: <span className="font-medium">{item.quantity}</span></p>
                                                            <p className="text-sm text-gray-600">Prix unitaire: <span className="font-medium">{formatPrice(item.priceAtOrder)}</span></p>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Détails de livraison et paiement */}
                                        <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-10 text-gray-700">
                                            <div>
                                                <h3 className="text-xl font-bold text-gray-800 mb-4 border-b-2 pb-2 border-blue-200">Adresse de livraison</h3>
                                                <p className="text-base leading-relaxed">{order.shippingAddressLine1}</p>
                                                {order.shippingAddressLine2 && <p className="text-base leading-relaxed">{order.shippingAddressLine2}</p>}
                                                <p className="text-base leading-relaxed">{order.shippingCity}, {order.shippingState}</p>
                                                {order.shippingZipCode && <p className="text-base leading-relaxed">{order.shippingZipCode}</p>}
                                                <p className="text-base leading-relaxed">{order.shippingCountry}</p>
                                            </div>
                                            <div>
                                                <h3 className="text-xl font-bold text-gray-800 mb-4 border-b-2 pb-2 border-blue-200">Contact & Paiement</h3>
                                                <p className="text-base leading-relaxed">Email: <span className="font-medium">{order.userEmail}</span></p>
                                                {order.userPhoneNumber && <p className="text-base leading-relaxed">Téléphone: <span className="font-medium">{order.userPhoneNumber}</span></p>}
                                                <p className="text-base leading-relaxed mt-4">Méthode de paiement: <span className="font-medium">{order.paymentMethod || 'Non spécifié'}</span></p>
                                                {/* ID de transaction Kkiapay supprimé comme demandé */}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
            <Footer />
        </>
    );
};

export default MyOrdersPage;
