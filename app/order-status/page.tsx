// app/order-status/page.tsx
'use client';
import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useAppContext } from '@/context/AppContext';

/**
 * Composant de la page de statut de commande.
 * Affiche le statut d'un paiement (succès, échec, en attente) basé sur les paramètres d'URL.
 * Met à jour le panier et l'historique des commandes en conséquence.
 * @returns {React.ReactElement} Le JSX de la page de statut de commande.
 */
const OrderStatusPage = (): React.ReactElement => {
    const searchParams = useSearchParams();
    const { loadCartData, fetchUserOrders } = useAppContext();

    // Type les états avec leurs types possibles
    const [status, setStatus] = useState<'loading' | 'success' | 'failed' | 'pending'>('loading');
    const [message, setMessage] = useState<string>('Vérification du statut de votre paiement...');
    // L'état 'transactionId' a été supprimé car il n'est pas directement utilisé pour l'affichage,
    // on utilise directement la valeur du paramètre d'URL pour l'affichage.
    const [orderRef, setOrderRef] = useState<string | null>(null);

    useEffect(() => {
        // Récupération des paramètres d'URL
        const receivedStatus: string | null = searchParams.get('status');
        const receivedOrderId: string | null = searchParams.get('orderId'); // Votre référence de commande interne
        const receivedMessage: string | null = searchParams.get('message');
        // const kkiapayTransactionIdParam: string | null = searchParams.get('transaction_id'); // Pas besoin de le récupérer dans l'état ici

        // Définir la référence de la commande interne
        setOrderRef(receivedOrderId);

        // L'appel à setTransactionId(kkiapayTransactionIdParam) a été supprimé ici car l'état transactionId n'existe plus.

        if (receivedStatus === 'success') {
            setStatus('success');
            setMessage('Paiement réussi ! Votre commande est en cours de traitement et votre panier a été vidé.');
            loadCartData(); // Vide le panier
            fetchUserOrders(); // Rafraîchit les commandes de l'utilisateur
        } else if (receivedStatus === 'failed') {
            setStatus('failed');
            setMessage(`Le paiement a échoué ou a été annulé. ${receivedMessage || 'Veuillez réessayer.'}`);
        } else if (receivedStatus === 'error') { // 'error' est souvent utilisé pour des erreurs techniques côté serveur de paiement
            setStatus('failed'); // Traiter comme un échec pour l'utilisateur
            setMessage(`Une erreur est survenue lors du traitement de votre commande. ${receivedMessage || 'Veuillez réessayer plus tard.'}`);
        } else {
            // Cas par défaut si le statut n'est pas clair ou si la page est chargée sans paramètres
            setStatus('pending');
            setMessage('Statut de paiement incertain. Nous vérifions votre commande. Veuillez patienter ou vérifier votre historique de commandes.');
        }
    }, [searchParams, loadCartData, fetchUserOrders]); // Dépendances du useEffect

    // On récupère kkiapayTransactionIdParam directement ici pour la logique d'affichage.
    // C'est la meilleure pratique car c'est une valeur statique pour cette render.
    const kkiapayTransactionIdParamForDisplay: string | null = searchParams.get('transaction_id');

    return (
        <div className="min-h-[calc(100vh-80px)] flex items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-blue-50 p-6">
            <div className="max-w-md w-full bg-white rounded-3xl shadow-2xl p-10 text-center space-y-6">
                {status === 'loading' && (
                    <Loader2 className="mx-auto h-20 w-20 text-indigo-500 animate-spin" aria-label="Chargement du statut du paiement" />
                )}
                {status === 'success' && (
                    <CheckCircle className="mx-auto h-20 w-20 text-green-500" aria-label="Paiement réussi" />
                )}
                {status === 'failed' && (
                    <XCircle className="mx-auto h-20 w-20 text-red-500" aria-label="Paiement échoué" />
                )}
                {status === 'pending' && (
                    <Loader2 className="mx-auto h-20 w-20 text-yellow-400 animate-spin" aria-label="Statut du paiement en attente" />
                )}

                <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">
                    Statut de la Commande
                </h1>
                <p className="text-gray-700 text-lg leading-relaxed" role="status" aria-live="polite">{message}</p>

                {orderRef && (
                    <p className="text-sm text-gray-400 font-mono select-text break-all">
                        <span className="font-semibold">Référence de commande :</span> {orderRef}
                    </p>
                )}
                {kkiapayTransactionIdParamForDisplay && (
                    <p className="text-sm text-gray-400 font-mono select-text break-all">
                        <span className="font-semibold">Transaction Kkiapay :</span> {kkiapayTransactionIdParamForDisplay}
                    </p>
                )}

                <div className="flex flex-col sm:flex-row justify-center gap-4 mt-8">
                    <Link
                        href="/my-orders"
                        className="inline-block w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl px-6 py-3 shadow-md transition"
                        aria-label="Voir mes commandes"
                    >
                        Voir mes commandes
                    </Link>
                    {status === 'failed' && (
                        <Link
                            href="/cart"
                            className="inline-block w-full sm:w-auto text-indigo-600 hover:underline font-semibold rounded-xl px-6 py-3 border border-indigo-600 transition"
                            aria-label="Retourner au panier"
                        >
                            Retourner au panier
                        </Link>
                    )}
                </div>
            </div>
        </div>
    );
};

export default OrderStatusPage;