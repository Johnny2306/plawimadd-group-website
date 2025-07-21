// components/OrderSummary.tsx
'use client';

import React, { useEffect, useState, useRef } from "react";
import { useAppContext } from "@/context/AppContext";
import { toast } from "react-toastify";
import axios from "axios";
import { Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
// Importez OrderStatus et PaymentStatus de '@/lib/types'
import { Address, OrderItem, Order, OrderStatus, PaymentStatus, Product } from '@/lib/types';

// Ajoutez la déclaration minimale pour KkiapayErrorResponse si elle n'est pas déjà globale
type KkiapayErrorResponse = {
    transactionId?: string;
    reason?: { code?: string; message?: string };
    message?: string;
};

// Déclaration minimale pour KkiapaySuccessResponse si elle n'est pas déjà globale
type KkiapaySuccessResponse = {
    transactionId: string;
    data?: string;
    amount?: number;
    paymentMethod?: string;
    reference?: string;
    status?: string;
    email?: string;
    phone?: string;
};

// IMPORTANT : Les interfaces KkiapayOptions, KkiapaySuccessResponse, KkiapayErrorReason,
// et KkiapayErrorResponse, ainsi que le bloc `declare global`,
// DOIVENT ÊTRE DÉPLACÉS DANS UN FICHIER DE DÉFINITION GLOBALE (.d.ts),
// comme `kkiapay.d.ts` dans votre projet.
// JE LES AI SUPPRIMÉES D'ICI. Assurez-vous que votre kkiapay.d.ts est bien configuré comme discuté précédemment.

// kkiapay.d.ts (Exemple de contenu pour référence, ce fichier ne doit PAS être ici)
/*
// kkiapay.d.ts
interface KkiapayOptions {
    amount: number;
    api_key: string;
    callback: string;
    transaction_id: string;
    email?: string;
    phone?: string;
    position?: "center" | "right" | "left";
    sandbox?: boolean;
    data?: string;
}

interface KkiapaySuccessResponse {
    transactionId: string;
    data?: string;
    amount?: number;
    paymentMethod?: string;
    reference?: string;
    status?: string;
    email?: string;
    phone?: string;
}

interface KkiapayErrorReason {
    code?: string;
    message?: string;
}

interface KkiapayErrorResponse {
    transactionId?: string;
    reason?: KkiapayErrorReason;
    message?: string;
}

declare global {
    interface Window {
        openKkiapayWidget: (options: KkiapayOptions) => void;
        addSuccessListener: (callback: (response: KkiapaySuccessResponse) => void) => void;
        addFailedListener: (callback: (error: KkiapayErrorResponse) => void) => void;
        removeSuccessListener: (callback: (response: KkiapaySuccessResponse) => void) => void;
        removeFailedListener: (callback: (error: KkiapayErrorResponse) => void) => void;
    }
}
*/
// FIN DE L'EXEMPLE Kkiapay.d.ts - Ne doit pas être dans ce fichier !

const OrderSummary = () => {
    const router = useRouter();
    const {
        currency,
        getCartCount,
        getCartAmount,
        currentUser,
        userAddresses,
        loadingAddresses,
        fetchUserAddresses,
        url,
        products, // C'est maintenant de type Product[]
        cartItems,
        formatPrice, // <--- C'EST ICI QUE LE CHANGEMENT A ÉTÉ FAIT AVANT
    } = useAppContext();

    const [selectedAddress, setSelectedAddress] = useState<Address | null>(null);
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [showKkiapayWidget, setShowKkiapayWidget] = useState(false);
    const [transactionIdForKkiapay, setTransactionIdForKkiapay] = useState<string | null>(null);
    const [preparedOrderPayload, setPreparedOrderPayload] = useState<Order | null>(null);

    const [isKkiapayWidgetApiReady, setIsKkiapayWidgetApiReady] = useState(false);
    const kkiapayApiCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const kkiapayOpenRetryTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Assurez-vous que le calcul du total est correct. Le 2% est-il un frais ?
    const totalAmountToPay = getCartCount() > 0 ? getCartAmount() + Math.floor(getCartAmount() * 0.02) : 0;

    const KKIAPAY_PUBLIC_API_KEY: string | undefined = process.env.NEXT_PUBLIC_KKIAPAY_PUBLIC_API_KEY;

    // --- NOUVEL EFFECT POUR CHARGER LES ADRESSES AU MONTAGE ---
    useEffect(() => {
        // Appeler fetchUserAddresses si les adresses ne sont pas encore chargées
        // et que l'utilisateur est connecté.
        if (currentUser && currentUser.id && userAddresses.length === 0 && !loadingAddresses) {
            console.log("[OrderSummary] Initial fetch of user addresses...");
            fetchUserAddresses();
        }
    }, [currentUser, userAddresses.length, loadingAddresses, fetchUserAddresses]);


    // --- EFFECT POUR DÉFINIR L'ADRESSE SÉLECTIONNÉE (Y COMPRIS PAR DÉFAUT) ---
    useEffect(() => {
        if (!loadingAddresses && userAddresses.length > 0) {
            console.log("[OrderSummary] userAddresses updated, attempting to set default/first address.");
            console.log("[OrderSummary] Current userAddresses:", userAddresses); // Log détaillé
            const defaultAddress = userAddresses.find((addr: Address) => addr.isDefault);
            if (defaultAddress) {
                console.log("[OrderSummary] Default address found and set:", defaultAddress);
                setSelectedAddress(defaultAddress);
            } else {
                // Si aucune adresse par défaut n'est trouvée, sélectionnez la première
                console.log("[OrderSummary] No default address found, setting first address:", userAddresses[0]);
                setSelectedAddress(userAddresses[0]);
            }
        } else if (!loadingAddresses && userAddresses.length === 0) {
            console.log("[OrderSummary] No addresses available, setting selectedAddress to null.");
            setSelectedAddress(null);
        }
    }, [userAddresses, loadingAddresses]);

    useEffect(() => {
        if (kkiapayApiCheckIntervalRef.current) {
            clearInterval(kkiapayApiCheckIntervalRef.current);
            kkiapayApiCheckIntervalRef.current = null;
        }

        const checkKkiapayApiFullAvailability = () => {
            return typeof window !== "undefined" &&
                typeof window.openKkiapayWidget === 'function' &&
                typeof window.addSuccessListener === 'function' &&
                typeof window.addFailedListener === 'function';
        };

        if (checkKkiapayApiFullAvailability()) {
            console.log('[Kkiapay Init] API openKkiapayWidget et les écouteurs sont immédiatement disponibles !');
            setIsKkiapayWidgetApiReady(true);
            return;
        }

        console.log("[Kkiapay Init] Démarrage du sondage pour la disponibilité de l'API Kkiapay...");
        kkiapayApiCheckIntervalRef.current = setInterval(() => {
            if (checkKkiapayApiFullAvailability()) {
                console.log('[Kkiapay Init] API openKkiapayWidget et les écouteurs sont maintenant disponibles ! Activation du bouton.');
                setIsKkiapayWidgetApiReady(true);
                if (kkiapayApiCheckIntervalRef.current) {
                    clearInterval(kkiapayApiCheckIntervalRef.current);
                    kkiapayApiCheckIntervalRef.current = null;
                }
            } else {
                console.log('[Kkiapay Init] API Kkiapay (openKkiapayWidget / addSuccessListener / addFailedListener) non encore disponible, attente en cours...');
            }
        }, 100);

        return () => {
            if (kkiapayApiCheckIntervalRef.current) {
                clearInterval(kkiapayApiCheckIntervalRef.current);
                kkiapayApiCheckIntervalRef.current = null;
            }
            console.log('[Kkiapay Init] Sondage de l\'API Kkiapay arrêté.');
        };
    }, []);

    const handleAddressSelect = async (address: Address) => {
        setSelectedAddress(address);
        setIsDropdownOpen(false);

        // L'ID de l'adresse peut être 'id' ou '_id'. Normalisez-le pour l'appel API.
        const addressId = address.id || address._id;

        if (currentUser && currentUser.id && addressId) {
            try {
                const headers = { 'Content-Type': 'application/json' };

                const response = await axios.put(
                    `${url}/api/addresses/${currentUser.id}`,
                    {
                        id: addressId, // Utilisez l'ID normalisé ici
                        fullName: address.fullName,
                        phoneNumber: address.phoneNumber,
                        pincode: address.pincode,
                        area: address.area,
                        city: address.city,
                        state: address.state,
                        isDefault: true // On met à jour pour la rendre par défaut
                    },
                    { headers }
                );

                if (response.status === 200 && response.data.success) {
                    toast.success("Adresse par défaut définie avec succès !");
                    fetchUserAddresses(); // Re-fetch pour mettre à jour le contexte avec la nouvelle adresse par défaut
                } else {
                    toast.error(`Échec de la définition de l'adresse par défaut: ${response.data.message || 'Erreur inconnue.'}`);
                }
            } catch (error) {
                console.error("Erreur setting default address:", error);
                toast.error(`Erreur réseau lors de la définition de l'adresse par défaut.`);
            }
        }
    };

    const createOrder = async () => {
        console.log("--- Début de la fonction createOrder ---");

        if (!selectedAddress) {
            console.log("[Create Order] ERREUR: Aucune adresse sélectionnée.");
            toast.error("Veuillez sélectionner ou ajouter une adresse de livraison pour continuer.");
            return;
        }

        if (!currentUser || !currentUser.id) {
            console.log("[Create Order] ERREUR: Utilisateur non connecté ou ID manquant.");
            toast.error("Veuillez vous connecter pour passer commande.");
            router.push('/login');
            return;
        }

        if (getCartCount() === 0) {
            console.log("[Create Order] ERREUR: Panier vide.");
            toast.error("Votre panier est vide.");
            return;
        }

        if (!isKkiapayWidgetApiReady) {
            console.log("[Create Order] ERREUR: API openKkiapayWidget non prête. Clic du bouton bloqué.");
            toast.info("Le module de paiement n'est pas encore prêt. Veuillez patienter un instant et réessayer.");
            return;
        }

        if (!KKIAPAY_PUBLIC_API_KEY) {
            console.log("[Create Order] ERREUR: KKIAPAY_PUBLIC_API_KEY est indéfini.");
            toast.error("La clé d'API publique Kkiapay n'est pas configurée. Veuillez contacter le support.");
            setIsLoading(false); // S'assurer de désactiver le chargement si cette erreur se produit
            return;
        }

        setIsLoading(true);
        toast.info("Préparation du paiement Kkiapay...");

        try {
            const prepareResponse = await axios.get<{ success: boolean; transactionId: string; message?: string }>(`${url}/api/order/prepare-payment`);

            if (prepareResponse.status === 200 && prepareResponse.data.success && prepareResponse.data.transactionId) {
                const newTransactionId = prepareResponse.data.transactionId;
                setTransactionIdForKkiapay(newTransactionId);

                const orderItems: OrderItem[] = Object.entries(cartItems).map(([productId, quantity]) => {
                    const numericQuantity = quantity as number;
                    // Assurez-vous que products est bien de type Product[] ici
                    const product = products.find((p: Product) => String(p.id) === String(productId));
                    if (!product) {
                        console.warn(`[Create Order] Produit avec ID ${productId} non trouvé dans la liste des produits.`);
                        return null;
                    }
                    return {
                        productId: productId,
                        quantity: numericQuantity,
                        price: product.offerPrice !== null && product.offerPrice !== undefined ? product.offerPrice : product.price,
                        name: product.name,
                        imgUrl: product.imgUrl && product.imgUrl.length > 0 ? product.imgUrl[0] : ''
                    };
                }).filter((item): item is OrderItem => item !== null);

                if (orderItems.length === 0) {
                    console.log("[Create Order] ERREUR: Le panier ne contient pas d'articles valides pour la commande après filtrage.");
                    toast.error("Le panier ne contient pas d'articles valides pour la commande.");
                    setIsLoading(false);
                    return;
                }

                const now = new Date();
                const fullOrderPayload: Order = {
                    id: newTransactionId, // L'ID de la commande peut être le transactionId pour Kkiapay
                    userId: currentUser.id,
                    orderItems: orderItems,
                    totalAmount: totalAmountToPay,
                    shippingAddressLine1: selectedAddress.street || selectedAddress.area || '', // Assurez-vous qu'ils ne sont pas undefined
                    shippingAddressLine2: null,
                    shippingCity: selectedAddress.city || '',
                    shippingState: selectedAddress.state || '',
                    shippingZipCode: selectedAddress.pincode || null,
                    shippingCountry: selectedAddress.country || 'Bénin',
                    userEmail: currentUser.email || '',
                    userPhoneNumber: selectedAddress.phoneNumber || '',
                    currency: currency,
                    kakapayTransactionId: newTransactionId,
                    status: OrderStatus.PENDING, // Utilisez l'enum de '@/lib/types'
                    paymentStatus: PaymentStatus.PENDING, // Utilisez l'enum de '@/lib/types'
                    orderDate: now.toISOString(), // Convertir en string ISO pour la cohérence si votre backend attend une string
                    createdAt: now.toISOString(),
                    updatedAt: now.toISOString(),
                    // CORRECTION ICI: shippingAddressId doit être une string ou null
                    shippingAddressId: selectedAddress.id || selectedAddress._id || null, // Utilisez l'ID de l'adresse comme string
                    shippingAddress: selectedAddress, // Vous pouvez inclure l'objet entier si votre backend le gère
                };
                setPreparedOrderPayload(fullOrderPayload);

                toast.success("Commande préparée ! Tentative d'ouverture du paiement Kkiapay...");
                setShowKkiapayWidget(true);
                console.log("[Create Order] showKkiapayWidget mis à true, déclenchement de l'ouverture du widget.");

            } else {
                console.error("[Create Order] L'API prepare-payment a échoué ou n'a pas renvoyé de transactionId.", prepareResponse.data);
                toast.error(`Erreur lors de la préparation de la commande: ${prepareResponse.data.message || 'Erreur inconnue.'}`);
            }
        } catch (error) {
            console.error("[Create Order] Erreur lors de la préparation de la commande Kkiapay (bloc catch):", error);
            if (axios.isAxiosError(error) && error.response) {
                toast.error(`Erreur serveur: ${error.response.data.message || 'Impossible de préparer la commande.'}`);
            } else {
                toast.error("Erreur inattendue lors de la commande.");
            }
        } finally {
            setIsLoading(false);
            console.log("--- Fin de la fonction createOrder ---");
        }
    };

    useEffect(() => {
        console.log("[Kkiapay Widget useEffect] showKkiapayWidget changed:", showKkiapayWidget, "transactionIdForKkiapay:", transactionIdForKkiapay, "preparedOrderPayload:", preparedOrderPayload); // NOUVEAU LOG

        if (kkiapayOpenRetryTimeoutRef.current) {
            clearTimeout(kkiapayOpenRetryTimeoutRef.current);
            kkiapayOpenRetryTimeoutRef.current = null;
        }

        if (showKkiapayWidget && transactionIdForKkiapay && preparedOrderPayload) {
            console.log("[Kkiapay Widget] Conditions showKkiapayWidget, transactionIdForKkiapay et preparedOrderPayload remplies. Déclenchement de la logique d'ouverture...");

            let retryCount = 0;
            const maxRetries = 60;
            const retryDelay = 100;

            const tryOpenKkiapayWidget = () => {
                // Vérifiez toujours si openKkiapayWidget est défini avant de l'appeler
                if (typeof window.openKkiapayWidget === 'function') {
                    console.log("[Kkiapay Widget] openKkiapayWidget() est ENFIN disponible. Ouverture du widget !");
                    window.openKkiapayWidget({
                        amount: totalAmountToPay,
                        api_key: KKIAPAY_PUBLIC_API_KEY as string,
                        callback: `${window.location.origin}/api/kkiapay-callback?transactionId=${transactionIdForKkiapay}`,
                        transaction_id: transactionIdForKkiapay,
                        email: currentUser?.email || '',
                        phone: selectedAddress?.phoneNumber || '',
                        position: "center",
                        sandbox: process.env.NODE_ENV === 'development',
                        data: JSON.stringify(preparedOrderPayload)
                    });

                    // Assurez-vous que les listeners sont ajoutés une seule fois ou retirés après usage
                    // Pour éviter les multiples écouteurs lors des re-renderings, on peut utiliser removeSuccessListener/removeFailedListener
                    // ou s'assurer que cet useEffect ne s'exécute que lorsque showKkiapayWidget passe à true pour la première fois.
                    // Pour cet exemple, je vais juste vérifier leur existence avant d'ajouter.
                    if (typeof window.addSuccessListener === 'function') {
                        // Il est bon de stocker la référence du listener pour pouvoir le supprimer dans le cleanup
                        const successListener = (response: KkiapaySuccessResponse) => {
                            console.log("[Kkiapay Widget] Paiement Kkiapay succès via addSuccessListener:", response);
                            setShowKkiapayWidget(false);
                            router.push(`/order-status?orderId=${response.transactionId || transactionIdForKkiapay}&status=success`);
                            // Optionnel: Supprimer le listener après qu'il a été déclenché
                            window.removeSuccessListener(successListener);
                        };
                        window.addSuccessListener(successListener);
                    } else {
                        console.warn("[Kkiapay Widget] addSuccessListener non trouvé. Les événements de succès ne seront pas capturés.");
                    }

                    if (typeof window.addFailedListener === 'function') {
                        const failedListener = (error: KkiapayErrorResponse) => {
                            const errorMessage = error.reason?.message || error.message || "Le paiement a échoué ou a été annulé.";
                            console.warn("[Kkiapay Widget] Paiement Kkiapay échec via addFailedListener:", error);
                            setShowKkiapayWidget(false);
                            router.push(`/order-status?orderId=${transactionIdForKkiapay}&status=failed&message=${encodeURIComponent(errorMessage)}`);
                            // Optionnel: Supprimer le listener après qu'il a été déclenché
                            window.removeFailedListener(failedListener);
                        };
                        window.addFailedListener(failedListener);
                    } else {
                        console.warn("[Kkiapay Widget] addFailedListener non trouvé. Les événements d'échec ne seront pas capturés.");
                    }

                } else {
                    retryCount++;
                    if (retryCount < maxRetries) {
                        console.warn(`[Kkiapay Widget] openKkiapayWidget() n'est pas encore disponible. Nouvelle tentative (${retryCount}/${maxRetries})...`);
                        kkiapayOpenRetryTimeoutRef.current = setTimeout(tryOpenKkiapayWidget, retryDelay);
                    } else {
                        console.error("[Kkiapay Widget] CRITIQUE FINALE : openKkiapayWidget() n'est pas devenu disponible après de multiples tentatives. Le widget ne peut pas s'ouvrir. Problème d'initialisation de l'API JavaScript Kkiapay.");
                        toast.error("Erreur critique : Le module de paiement n'est pas utilisable. Veuillez contacter le support technique de Kkiapay.");
                        setShowKkiapayWidget(false);
                    }
                }
            };

            tryOpenKkiapayWidget();

        } else if (showKkiapayWidget && !transactionIdForKkiapay) {
            console.log("[Kkiapay Widget] Le widget Kkiapay ne peut pas s'ouvrir : ID de transaction manquant (log dans showKkiapayWidget useEffect).", { showKkiapayWidget, transactionIdForKkiapay });
        } else if (showKkiapayWidget && !preparedOrderPayload) {
            console.log("[Kkiapay Widget] Le widget Kkiapay ne peut pas s'ouvrir : Payload de commande non préparé.", { showKkiapayWidget, preparedOrderPayload });
        }

        return () => {
            if (kkiapayOpenRetryTimeoutRef.current) {
                clearTimeout(kkiapayOpenRetryTimeoutRef.current);
                kkiapayOpenRetryTimeoutRef.current = null;
            }
            // Considérez si vous devez supprimer les listeners Kkiapay ici
            // Cela dépend de la persistance de l'instance du widget Kkiapay et de vos besoins.
            // Si le widget est un singleton global et que les listeners s'accumulent, il faut les retirer.
        };
    }, [showKkiapayWidget, transactionIdForKkiapay, preparedOrderPayload, totalAmountToPay, currentUser, selectedAddress, KKIAPAY_PUBLIC_API_KEY, currency, router]);


    const isButtonDisabled = getCartCount() === 0 || isLoading || !isKkiapayWidgetApiReady || !KKIAPAY_PUBLIC_API_KEY || !selectedAddress; // Désactiver si aucune adresse

    console.log("--- État du composant OrderSummary ---");
    console.log("Panier vide (getCartCount() === 0):", getCartCount() === 0);
    console.log("En chargement (isLoading):", isLoading);
    console.log("API Kkiapay prête (isKkiapayWidgetApiReady - CLÉ pour activer le bouton):", isKkiapayWidgetApiReady);
    console.log("Clé publique Kkiapay définie (KKIAPAY_PUBLIC_API_KEY):", KKIAPAY_PUBLIC_API_KEY ? "Defined" : "Undefined");
    console.log("Adresse sélectionnée (selectedAddress):", selectedAddress ? "Defined" : "Undefined", selectedAddress); // Ajouté pour le débogage
    console.log("Bouton désactivé (isButtonDisabled - calculé):", isButtonDisabled);
    console.log("Transaction ID for Kkiapay (état local):", transactionIdForKkiapay);
    console.log("Prepared Order Payload (état local):", preparedOrderPayload);
    console.log("Current user:", currentUser);
    console.log("User Addresses (from context):", userAddresses); // Ajouté pour le débogage
    console.log("Cart Items:", cartItems);
    console.log("Products (sample):", products.length > 0 ? products.slice(0, 2) : "No products loaded");
    console.log("-----------------------------------");

    return (
        <div className="w-full md:w-96 bg-white rounded-lg shadow-md p-6 space-y-6">
            <h2 className="text-2xl font-semibold text-gray-800">
                Résumé de la commande
            </h2>

            <div>
                <label className="block text-gray-600 font-medium mb-2">
                    Sélectionnez une adresse
                </label>
                <div className="relative">
                    <button
                        className="w-full px-4 py-3 border rounded-md bg-gray-50 text-gray-700 focus:outline-none hover:bg-gray-100 flex justify-between items-center"
                        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                        disabled={loadingAddresses || isLoading}
                    >
                        <span>
                            {loadingAddresses
                                ? "Chargement des adresses..."
                                : selectedAddress
                                    ? `${selectedAddress.fullName}, ${selectedAddress.area}, ${selectedAddress.city} ${selectedAddress.isDefault ? '(Par défaut)' : ''}` // Ajout de l'indicateur par défaut
                                    : "Veuillez sélectionner une adresse"}
                        </span>
                        <svg
                            className={`w-5 h-5 ml-2 inline transition-transform ${isDropdownOpen ? "rotate-180" : ""}`}
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                        >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                    </button>

                    {isDropdownOpen && (
                        <ul className="absolute mt-2 w-full bg-white border rounded-md shadow-lg max-h-48 overflow-y-auto z-10">
                            {userAddresses.length > 0 ? (
                                userAddresses.map((address: Address) => (
                                    <li
                                        key={address.id || address._id}
                                        className="px-4 py-2 hover:bg-gray-100 cursor-pointer flex justify-between items-center" // Ajout de flex pour l'alignement
                                        onClick={() => handleAddressSelect(address)}
                                    >
                                        <span>
                                            {address.fullName}, {address.area}, {address.city}, {address.state}
                                            {address.isDefault && <span className="ml-2 text-xs font-semibold text-blue-600">(Par défaut)</span>}
                                        </span>
                                    </li>
                                ))
                            ) : (
                                <li className="px-4 py-2 text-gray-500 text-center">Aucune adresse trouvée.</li>
                            )}
                            <li
                                className="px-4 py-2 text-blue-600 hover:text-blue-800 hover:bg-gray-100 cursor-pointer text-center border-t mt-1 pt-1"
                                onClick={() => {
                                    setIsDropdownOpen(false);
                                    router.push("/add-address");
                                }}
                            >
                                + Ajouter une nouvelle adresse
                            </li>
                        </ul>
                    )}
                </div>
            </div>

            <div className="space-y-4">
                <div className="flex justify-between text-gray-700">
                    <span>Articles ({getCartCount()})</span>
                    <span>{formatPrice(getCartAmount())}</span>
                </div>

                <div className="flex justify-between text-gray-700 font-semibold border-t pt-4">
                    <span>Total à payer</span>
                    <span>{formatPrice(totalAmountToPay)}</span>
                </div>
            </div>

            <button
                onClick={createOrder}
                className="w-full py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition flex items-center justify-center"
                disabled={isButtonDisabled}
            >
                {isLoading ? (
                    <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Préparation du paiement...
                    </>
                ) : (
                    "Procéder au Paiement avec Kkiapay"
                )}
            </button>
        </div>
    );
};

export default OrderSummary;
