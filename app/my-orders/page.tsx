// app/my-orders/page.tsx
'use client';
import React, { useEffect, useState, useCallback } from "react";
import { assets } from "@/assets/assets";
import Image from "next/image";
import { useAppContext } from "@/context/AppContext";
import Footer from "@/components/Footer";
import Loading from "@/components/Loading";
// Assurez-vous que ces types sont importés correctement depuis votre fichier types.ts
import { Order, OrderItem, OrderStatus, PaymentStatus } from '@/lib/types';
/**
 * Composant de la page "Mes Commandes".
 * Affiche l'historique des commandes de l'utilisateur connecté.
 * @returns {React.ReactElement} Le JSX de la page des commandes.
 */
const MyOrders = (): React.ReactElement => {
    const { currency, userOrders, loadingOrders, fetchUserOrders, isLoggedIn, currentUser } = useAppContext();

    const orders: Order[] = userOrders;
    const loading: boolean = loadingOrders;
    const [error, setError] = useState<string | null>(null);

    const memoizedFetchUserOrders = useCallback(() => {
        fetchUserOrders();
    }, [fetchUserOrders]);

    useEffect(() => {
        if (isLoggedIn && currentUser?.id) {
            console.log("MyOrders component: User is logged in and currentUser.id is available, fetching orders.");
            setError(null);
            memoizedFetchUserOrders();
        } else if (!isLoggedIn) {
            setError("Veuillez vous connecter à votre compte pour consulter l'historique de vos commandes.");
        }
    }, [isLoggedIn, currentUser?.id, memoizedFetchUserOrders]);

    /**
     * Formate un timestamp ou un objet Date en date et heure lisibles en français.
     * @param {Date | string | number | undefined | null} dateTimeValue La valeur de date/heure à formater.
     * @returns {string} La date et l'heure formatées ou un message d'erreur.
     */
    const formatFullDateTime = (dateTimeValue: Date | string | number | undefined | null): string => {
        if (dateTimeValue === undefined || dateTimeValue === null) return "N/A";

        let date: Date;

        if (dateTimeValue instanceof Date) {
            date = dateTimeValue; // C'est déjà un objet Date
        } else if (typeof dateTimeValue === 'string') {
            // Tente de convertir en nombre si c'est une chaîne de chiffres (timestamp)
            const numericTimestamp = parseInt(dateTimeValue, 10);
            if (!isNaN(numericTimestamp) && numericTimestamp > 0) { // S'assurer que ce n'est pas 0 ou NaN
                 // Très grande valeur = ms, plus petite valeur = secondes (environ 13 chiffres pour ms)
                date = new Date(numericTimestamp < 1000000000000 ? numericTimestamp * 1000 : numericTimestamp);
            } else {
                // Sinon, essaie de parser la chaîne directement (ex: "YYYY-MM-DDTHH:mm:ss.sssZ")
                date = new Date(dateTimeValue);
            }
        } else if (typeof dateTimeValue === 'number') {
            // Si c'est un nombre, traite comme un timestamp
            date = new Date(dateTimeValue < 1000000000000 && dateTimeValue > 0 ? dateTimeValue * 1000 : dateTimeValue);
        } else {
            return "Date invalide"; // Pour tout autre type inattendu
        }

        if (isNaN(date.getTime())) {
            console.error("Failed to parse date/timestamp:", dateTimeValue);
            return "Date invalide";
        }

        return date.toLocaleString('fr-FR', {
            year: 'numeric', month: 'short', day: 'numeric',
            hour: '2-digit', minute: '2-digit',
            hour12: false
        });
    };

    /**
     * Détermine la classe CSS de couleur pour le badge de statut.
     * @param {OrderStatus | PaymentStatus} status Le statut de la commande ou du paiement.
     * @returns {string} La classe Tailwind CSS correspondante.
     */
    const getStatusBadgeStyle = (status: OrderStatus | PaymentStatus): string => { // Utilise les types d'énumération de Prisma
        switch (status.toUpperCase()) {
            case 'DELIVERED':
            case 'COMPLETED':
            case 'PAID':
                return 'text-green-600 font-bold';
            case 'PENDING':
            case 'PROCESSING':
            case 'SHIPPED':
                return 'text-orange-500 font-bold';
            case 'CANCELLED':
            case 'FAILED':
                return 'text-red-500 font-bold';
            default:
                return 'text-gray-600';
        }
    };

    return (
        <>
            <div className="flex flex-col justify-between px-6 md:px-16 lg:px-32 py-6 min-h-screen">
                <div className="space-y-5">
                    <h2 className="text-3xl font-bold text-gray-800 mb-6 mt-6 text-center">Mes Commandes</h2>
                    {loading ? (
                        <Loading />
                    ) : error ? (
                        <div className="text-center mt-8 p-4 bg-red-100 border border-red-300 text-red-700 rounded-lg" role="alert">
                            <p className="font-semibold mb-2">Erreur :</p>
                            <p>{error}</p>
                        </div>
                    ) : (
                        <div className="max-w-5xl mx-auto w-full">
                            {orders.length === 0 ? (
                                <p className="text-gray-600 mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg text-center shadow-sm">
                                    Vous n&#39;avez pas encore passé de commandes. N&#39;hésitez pas à explorer nos produits !
                                </p>
                            ) : (
                                <div className="grid gap-6">
                                    {orders.map((order: Order) => (
                                        <div key={order.id} className="flex flex-col md:flex-row gap-5 justify-between p-5 border border-gray-200 rounded-lg shadow-sm bg-white">
                                            {/* Section Articles */}
                                            <div className="flex-1 flex flex-col gap-3">
                                                <Image
                                                    className="w-16 h-16 object-cover mb-2 rounded-md"
                                                    src={assets.box_icon}
                                                    alt="icône de commande"
                                                    width={64}
                                                    height={64}
                                                    priority
                                                />
                                                {/* Utilisation de order.id et troncature */}
                                                <h3 className="font-bold text-lg text-gray-800">Commande #{order.id.substring(0, 8)}</h3>
                                                <p className="font-medium text-base text-gray-700">
                                                    Articles ({order.orderItems ? order.orderItems.length : 0}) :{" "}
                                                    <span className="font-normal">
                                                        {order.orderItems && order.orderItems.length > 0 ?
                                                            order.orderItems.map((item: OrderItem) => `${item.name} x ${item.quantity}`).join(", ")
                                                            : "Aucun article"
                                                        }
                                                    </span>
                                                </p>
                                                <p className="text-gray-700">
                                                    Montant total : <span className="font-semibold text-blue-700">{currency}{parseFloat(order.totalAmount.toString()).toFixed(2)}</span>
                                                </p>
                                                {/* Utilisation de order.status */}
                                                <p className="text-gray-700">
                                                    Statut de la commande : <span className={`font-semibold ${getStatusBadgeStyle(order.status)}`}>{order.status}</span>
                                                </p>
                                            </div>

                                            {/* Section Adresse de livraison */}
                                            <div className="flex flex-col p-4 bg-gray-50 rounded-md">
                                                <p className="font-semibold mb-2 text-gray-800">Adresse de livraison :</p>
                                                <address className="not-italic text-gray-700">
                                                    {/* Utilisation des propriétés de l'interface Order pour l'adresse */}
                                                    <span>{order.shippingAddressLine1 || 'N/A'}</span>
                                                    {order.shippingAddressLine2 && <><br /><span>{order.shippingAddressLine2}</span></>}
                                                    <br />
                                                    <span>{`${order.shippingCity || 'N/A'}, ${order.shippingState || 'N/A'}`}</span>
                                                    <br />
                                                    <span>{order.shippingZipCode || 'N/A'}</span>
                                                    <br />
                                                    <span>{order.shippingCountry || 'N/A'}</span>
                                                    {/* Utilisation de userPhoneNumber de l'ordre */}
                                                    {order.userPhoneNumber ? (
                                                        <><br /><span className="font-medium">Tél: {order.userPhoneNumber}</span></>
                                                    ) : (
                                                        <><br /><span className="font-medium text-gray-500">Tél: Non spécifié</span></>
                                                    )}
                                                </address>
                                            </div>

                                            {/* Section Détails du paiement */}
                                            <div className="flex flex-col p-4 bg-gray-50 rounded-md">
                                                <p className="font-semibold mb-2 text-gray-800">Détails du paiement :</p>
                                                <p className="text-gray-700">
                                                    {/* Il n'y a pas de 'paymentMethod' directement sur l'interface Order
                                                        Si le paiement est géré via un service externe, le type de paiement pourrait être lié au kakapayTransactionId
                                                        Pour l'instant, je mets un placeholder. Vous devrez peut-être ajuster ici selon la source de cette donnée.
                                                    */}
                                                    Méthode : <span className="font-normal">{order.kakapayTransactionId ? 'Kakapay' : 'Non spécifié'}</span>
                                                    <br />
                                                    Paiement : <span className={`font-semibold ${getStatusBadgeStyle(order.paymentStatus)}`}>{order.paymentStatus}</span>
                                                    <br />
                                                    {/* Utilisation de order.orderDate qui est de type Date */}
                                                    Date : <span className="font-normal">{formatFullDateTime(order.orderDate)}</span>
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
            <Footer />
        </>
    );
};

export default MyOrders;