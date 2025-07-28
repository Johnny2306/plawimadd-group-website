// components/OrderSummary.tsx
'use client';

import React, { useEffect, useState, useRef, useCallback } from "react";
import { useAppContext } from "@/context/AppContext";
import { toast } from "react-toastify";
import axios from "axios";
import { Loader2 } from 'lucide-react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { v4 as uuidv4 } from 'uuid'; // Pour générer l'ID de transaction Kkiapay

import { Address, Product, CreateOrderPayload, OrderItemForCreatePayload } from '@/lib/types';

// Définitions de types pour la réponse Kkiapay
type KkiapayErrorResponse = {
    transactionId?: string;
    reason?: { code?: string; message?: string };
    message?: string;
};

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

// Déclaration de l'interface globale pour window.kkiapay
declare global {
    interface Window {
        openKkiapayWidget: (options: {
            amount: number;
            api_key: string;
            callback: string;
            transaction_id: string;
            email?: string;
            phone?: string;
            position?: string;
            sandbox?: boolean; // Maintenu pour la compatibilité de type
            data?: string;
        }) => void;
        addSuccessListener: (callback: (response: KkiapaySuccessResponse) => void) => void;
        removeSuccessListener: (callback: (response: KkiapaySuccessResponse) => void) => void;
        addFailedListener: (callback: (error: KkiapayErrorResponse) => void) => void;
        removeFailedListener: (callback: (error: KkiapayErrorResponse) => void) => void;
    }
}

const OrderSummary = () => {
    const router = useRouter();
    const searchParams = useSearchParams();
    const pathname = usePathname();

    const {
        currency,
        getCartCount,
        getCartAmount,
        currentUser,
        userAddresses,
        loadingAddresses,
        fetchUserAddresses,
        url,
        products,
        cartItems,
        formatPrice,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        clearCart, // Ignorer cet avertissement car clearCart est une fonction fournie par le contexte
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        loadCartData, // Maintenu pour le linter, mais plus appelé directement ici
    } = useAppContext();

    const [selectedAddress, setSelectedAddress] = useState<Address | null>(null);
    const [selectedAddressId, setSelectedAddressId] = useState<number | null>(null);
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [showKkiapayWidget, setShowKkiapayWidget] = useState(false);
    const [transactionIdForKkiapay, setTransactionIdForKkiapay] = useState<string | null>(null);

    const [isKkiapayWidgetApiReady, setIsKkiapayWidgetApiReady] = useState(false);
    const kkiapayApiCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const kkiapayOpenRetryTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const [addressLoadingTimeoutId, setAddressLoadingTimeoutId] = useState<NodeJS.Timeout | null>(null);
    const [displayPromptForAddress, setDisplayPromptForAddress] = useState(false);

    const totalAmountToPay = getCartAmount();

    const KKIAPAY_PUBLIC_API_KEY: string | undefined = process.env.NEXT_PUBLIC_KKIAPAY_PUBLIC_API_KEY;

    // --- EFFECT POUR DÉCLENCHER LE CHARGEMENT INITIAL DES ADRESSES ---
    useEffect(() => {
        console.log("[OrderSummary] Initial fetch useEffect. currentUser:", !!currentUser, "userAddresses.length:", userAddresses.length, "loadingAddresses:", loadingAddresses);
        if (currentUser && currentUser.id && userAddresses.length === 0 && !loadingAddresses) {
            console.log("[OrderSummary] Déclenchement du chargement initial des adresses via AppContext...");
            fetchUserAddresses();
        }
    }, [currentUser, userAddresses.length, loadingAddresses, fetchUserAddresses]);

    // --- EFFECT CONSOLIDÉ POUR GÉRER LE TIMEOUT, LE PROMPT ET LA SÉLECTION D'ADRESSE ---
    useEffect(() => {
        console.log("[Address Effect Debug] Effect triggered. loadingAddresses:", loadingAddresses, "userAddresses.length:", userAddresses.length, "selectedAddressId (before effect logic):", selectedAddressId);

        if (addressLoadingTimeoutId) {
            clearTimeout(addressLoadingTimeoutId);
            setAddressLoadingTimeoutId(null);
            console.log("[Address Effect Debug] Cleared existing address loading timeout.");
        }

        if (loadingAddresses) {
            if (!addressLoadingTimeoutId) {
                console.log("[Address Effect Debug] Loading in progress. Starting 60-second timeout for address loading...");
                const id = setTimeout(() => {
                    console.log("[Address Effect Debug] Address loading timed out after 60 seconds. Prompting user to add address.");
                    setDisplayPromptForAddress(true);
                    setAddressLoadingTimeoutId(null);
                }, 60000);
                setAddressLoadingTimeoutId(id);
            }
        } else {
            console.log("[Address Effect Debug] Loading finished. userAddresses:", userAddresses);
            if (userAddresses.length === 0) {
                console.log("[Address Effect Debug] No addresses found after loading. Displaying prompt.");
                setDisplayPromptForAddress(true);
                setSelectedAddress(null);
                setSelectedAddressId(null);
            } else {
                console.log("[Address Effect Debug] Addresses found after loading. Hiding prompt and attempting to select address.");
                setDisplayPromptForAddress(false);

                const newAddressIdFromParam = searchParams.get('newAddressId');
                let addressToSelect: Address | undefined;

                if (newAddressIdFromParam) {
                    // Convertir newAddressIdFromParam en nombre pour la recherche
                    const parsedNewAddressId = parseInt(newAddressIdFromParam, 10);
                    if (!isNaN(parsedNewAddressId)) {
                        addressToSelect = userAddresses.find((addr: Address) => addr.id === parsedNewAddressId);
                    }
                    if (addressToSelect) {
                        console.log("[Address Effect Debug] Found address via newAddressId param:", addressToSelect);
                        if (!addressToSelect.isDefault && currentUser && currentUser.id) {
                            console.log("[Address Effect Debug] Setting new address as default via API...");
                            axios.put(
                                `${url}/api/addresses/${currentUser.id}`,
                                {
                                    id: addressToSelect.id, // L'ID est un nombre ici
                                    isDefault: true,
                                    fullName: addressToSelect.fullName,
                                    phoneNumber: addressToSelect.phoneNumber,
                                    area: addressToSelect.area,
                                    city: addressToSelect.city,
                                    state: addressToSelect.state,
                                    street: addressToSelect.street,
                                    country: addressToSelect.country,
                                    pincode: addressToSelect.pincode,
                                },
                                { headers: { 'Content-Type': 'application/json' } }
                            ).then(response => {
                                if (response.data.success) {
                                    toast.success("Nouvelle adresse définie par défaut !");
                                    fetchUserAddresses();
                                    router.replace(pathname);
                                    console.log("[Address Effect Debug] Default address set successfully, routing to clear param.");
                                } else {
                                    toast.error("Échec de la définition de la nouvelle adresse par défaut.");
                                    console.warn("[Address Effect Debug] Failed to set new address as default:", response.data.message);
                                }
                            }).catch(error => {
                                console.error("Erreur setting default address:", error);
                                toast.error("Erreur réseau lors de la mise à jour de l'adresse par défaut.");
                            });
                        }
                    } else {
                        console.log("[Address Effect Debug] newAddressId param present, but address not found in userAddresses. Falling back to default/first.");
                    }
                }

                if (!addressToSelect) {
                    const defaultAddress = userAddresses.find((addr: Address) => addr.isDefault);
                    if (defaultAddress) {
                        console.log("[Address Effect Debug] No newAddressId or not found, found default address:", defaultAddress);
                        addressToSelect = defaultAddress;
                    } else if (userAddresses.length > 0) {
                        console.log("[Address Effect Debug] No newAddressId and no default, selecting first address:", userAddresses[0]);
                        addressToSelect = userAddresses[0];
                    }
                }

                const currentSelectedId = selectedAddress?.id; // selectedAddress.id est maintenant un number
                const newSelectedId = addressToSelect?.id;

                if (addressToSelect && newSelectedId !== currentSelectedId) {
                    console.log("[Address Effect Debug] Updating selectedAddress to:", addressToSelect);
                    setSelectedAddress(addressToSelect);
                    setSelectedAddressId(newSelectedId || null);
                } else if (!addressToSelect && selectedAddressId !== null) {
                    console.log("[Address Effect Debug] No address to select, clearing selectedAddress.");
                    setSelectedAddress(null);
                    setSelectedAddressId(null);
                } else {
                    console.log("[Address Effect Debug] selectedAddress is already correctly set or no address to select.");
                }
            }
        }

        return () => {
            if (addressLoadingTimeoutId) {
                clearTimeout(addressLoadingTimeoutId);
                setAddressLoadingTimeoutId(null);
            }
        };
    }, [
        loadingAddresses,
        userAddresses,
        addressLoadingTimeoutId,
        searchParams,
        currentUser,
        url,
        router,
        fetchUserAddresses,
        selectedAddress,
        selectedAddressId,
        pathname
    ]);

    // Initialisation de Kkiapay API
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

    // Gère la sélection d'une adresse par l'utilisateur
    const handleAddressSelect = useCallback(async (address: Address) => {
        console.log("[handleAddressSelect] User selected address:", address);
        setSelectedAddress(address);
        setSelectedAddressId(address.id || null); // L'ID est un nombre

        setIsDropdownOpen(false);

        const addressId = address.id;

        if (currentUser && currentUser.id && addressId !== undefined && addressId !== null) {
            try {
                const headers = { 'Content-Type': 'application/json' };
                console.log(`[handleAddressSelect] Attempting to set address ${addressId} as default.`);
                const response = await axios.put(
                    `${url}/api/addresses/${currentUser.id}`,
                    {
                        id: addressId,
                        isDefault: true,
                        fullName: address.fullName,
                        phoneNumber: address.phoneNumber,
                        pincode: address.pincode,
                        area: address.area,
                        city: address.city,
                        state: address.state,
                        street: address.street,
                        country: address.country,
                    },
                    { headers }
                );

                if (response.status === 200 && response.data.success) {
                    toast.success("Nouvelle adresse définie par défaut !");
                    fetchUserAddresses();
                } else {
                    toast.error(`Échec de la définition de l'adresse par défaut: ${response.data.message || 'Erreur inconnue.'}`);
                }
            } catch (error) {
                console.error("Erreur setting default address:", error);
                toast.error(`Erreur réseau lors de la définition de l'adresse par défaut.`);
            }
        }
    }, [currentUser, url, fetchUserAddresses]);

    // Fonction pour créer la commande et initier le paiement Kkiapay
    const createOrder = async () => {
        console.log("--- Début de la fonction createOrder ---");

        if (!selectedAddress) {
            console.log("[Create Order] ERREUR: Aucune adresse sélectionnée.");
            toast.error("Veuillez sélectionner ou ajouter une adresse de livraison pour continuer.");
            return;
        }

        if (!currentUser || !currentUser.id || !currentUser.email || !currentUser.token) {
            console.log("[Create Order] ERREUR: Utilisateur non connecté ou informations manquantes.");
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
            setIsLoading(false);
            return;
        }

        setIsLoading(true);
        toast.info("Préparation de la commande et du paiement Kkiapay...");

        try {
            // Étape 1: Générer un ID de transaction unique (UUID) pour la commande
            const newTransactionId = uuidv4();
            setTransactionIdForKkiapay(newTransactionId);
            console.log(`[Create Order] Generated new transaction ID for order: ${newTransactionId}`);

            // Étape 2: Construire le payload de la commande pour notre API /api/order/create
            const orderItemsForPayload: OrderItemForCreatePayload[] = Object.entries(cartItems).map(([productId, quantity]) => {
                const numericQuantity = quantity as number;
                const product = products.find((p: Product) => String(p.id) === String(productId));
                if (!product) {
                    console.warn(`[Create Order] Produit avec ID ${productId} non trouvé dans la liste des produits.`);
                    return null;
                }
                return {
                    productId: productId,
                    quantity: numericQuantity,
                    price: product.offerPrice ?? product.price,
                };
            }).filter((item): item is OrderItemForCreatePayload => item !== null);

            if (orderItemsForPayload.length === 0) {
                console.log("[Create Order] ERREUR: Le panier ne contient pas d'articles valides pour la commande après filtrage.");
                toast.error("Le panier ne contient pas d'articles valides pour la commande.");
                setIsLoading(false);
                return;
            }

            const createOrderPayload: CreateOrderPayload = {
                id: newTransactionId,
                items: orderItemsForPayload,
                totalAmount: totalAmountToPay,
                shippingAddress: selectedAddress,
                paymentMethod: "Kkiapay",
                userEmail: currentUser.email,
                userPhoneNumber: selectedAddress.phoneNumber || currentUser.phoneNumber || null,
                currency: currency,
            };

            // Étape 3: Créer la commande dans notre base de données avec statut PENDING
            const createOrderResponse = await axios.post<{ success: boolean; orderId: string; message?: string }>(
                `${url}/api/order/create`,
                createOrderPayload,
                { headers: { 'Content-Type': 'application/json', 'auth-token': currentUser.token } }
            );

            if (createOrderResponse.status !== 201 || !createOrderResponse.data.success || !createOrderResponse.data.orderId) {
                console.error("[Create Order] L'API /api/order/create a échoué.", createOrderResponse.data);
                toast.error(`Erreur lors de la création de la commande: ${createOrderResponse.data.message || 'Erreur inconnue.'}`);
                setIsLoading(false);
                return;
            }
            console.log(`[Create Order] Commande ${createOrderResponse.data.orderId} créée en DB avec statut PENDING.`);

            toast.success("Commande enregistrée ! Ouverture du paiement Kkiapay...");
            setShowKkiapayWidget(true); // Déclenche l'ouverture du widget Kkiapay via useEffect

        } catch (error) {
            console.error("[Create Order] Erreur lors de la création de la commande:", error);
            if (axios.isAxiosError(error) && error.response) {
                toast.error(`Erreur serveur: ${error.response.data.message || 'Impossible de créer la commande.'}`);
            } else {
                toast.error("Erreur inattendue lors de la commande.");
            }
        } finally {
            setIsLoading(false);
            console.log("--- Fin de la fonction createOrder ---");
        }
    };

    // --- EFFECT POUR OUVRIR LE WIDGET KKIAPAY ET GÉRER LES LISTENERS ---
    useEffect(() => {
        console.log("[Kkiapay Widget useEffect] showKkiapayWidget changed:", showKkiapayWidget, "transactionIdForKkiapay:", transactionIdForKkiapay);

        if (kkiapayOpenRetryTimeoutRef.current) {
            clearTimeout(kkiapayOpenRetryTimeoutRef.current);
            kkiapayOpenRetryTimeoutRef.current = null;
        }

        // Le widget Kkiapay ne s'ouvre que si showKkiapayWidget est vrai ET que l'ID de transaction est présent
        if (showKkiapayWidget && transactionIdForKkiapay) {
            console.log("[Kkiapay Widget] Conditions showKkiapayWidget et transactionIdForKkiapay remplies. Déclenchement de la logique d'ouverture...");

            let retryCount = 0;
            const maxRetries = 60;
            const retryDelay = 100;

            const tryOpenKkiapayWidget = () => {
                if (typeof window.openKkiapayWidget === 'function') {
                    console.log("[Kkiapay Widget] openKkiapayWidget() est ENFIN disponible. Ouverture du widget !");
                    window.openKkiapayWidget({
                        amount: totalAmountToPay,
                        api_key: KKIAPAY_PUBLIC_API_KEY as string,
                        callback: `${window.location.origin}/api/kkiapay-callback?transactionId=${transactionIdForKkiapay}`, // Passer notre orderId/transactionId
                        transaction_id: transactionIdForKkiapay, // Kkiapay peut aussi l'utiliser
                        email: currentUser?.email ?? '',
                        phone: selectedAddress?.phoneNumber ?? '',
                        position: "center",
                        sandbox: false, // <-- MODIFICATION CLÉ : Toujours en mode Live
                        // Ne pas passer le payload complet à Kkiapay.data
                        // data: JSON.stringify(preparedOrderPayload) // REMOVED
                    });

                    if (typeof window.addSuccessListener === 'function') {
                        const successListener = (response: KkiapaySuccessResponse) => {
                            console.log("[Kkiapay Widget] Paiement Kkiapay succès via addSuccessListener:", response);
                            setShowKkiapayWidget(false);
                            // Rediriger vers la page de statut de la commande avec l'ID de notre commande
                            router.push(`/order-status?orderId=${transactionIdForKkiapay}&status=success`);
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
                            // Rediriger vers la page de statut de la commande avec l'ID de notre commande
                            router.push(`/order-status?orderId=${transactionIdForKkiapay}&status=failed&message=${encodeURIComponent(errorMessage)}`);
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
            setShowKkiapayWidget(false);
        }

        return () => {
            if (kkiapayOpenRetryTimeoutRef.current) {
                clearTimeout(kkiapayOpenRetryTimeoutRef.current);
                kkiapayOpenRetryTimeoutRef.current = null;
            }
        };
    }, [showKkiapayWidget, transactionIdForKkiapay, totalAmountToPay, currentUser, selectedAddress, KKIAPAY_PUBLIC_API_KEY, currency, router]);


    const isButtonDisabled = getCartCount() === 0 || isLoading || !isKkiapayWidgetApiReady || !KKIAPAY_PUBLIC_API_KEY || !selectedAddress;

    console.log("--- État du composant OrderSummary (Rendu) ---");
    console.log("Panier vide (getCartCount() === 0):", getCartCount() === 0);
    console.log("En chargement (isLoading - bouton):", isLoading);
    console.log("API Kkiapay prête (isKkiapayWidgetApiReady - CLÉ pour activer le bouton):", isKkiapayWidgetApiReady);
    console.log("Clé publique Kkiapay définie (KKIAPAY_PUBLIC_API_KEY):", KKIAPAY_PUBLIC_API_KEY ? "Defined" : "Undefined");
    console.log("Adresse sélectionnée (selectedAddress):", selectedAddress ? "Defined" : "Undefined", selectedAddress);
    console.log("ID d'adresse sélectionnée (selectedAddressId):", selectedAddressId);
    console.log("Bouton désactivé (isButtonDisabled - calculé):", isButtonDisabled);
    console.log("Transaction ID for Kkiapay (état local):", transactionIdForKkiapay);
    console.log("Current user:", currentUser);
    console.log("User Addresses (from context):", userAddresses);
    console.log("Loading Addresses (from context):", loadingAddresses);
    console.log("Display Prompt For Address (état local):", displayPromptForAddress);
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
                    Sélectionner une Adresse
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
                                : userAddresses.length === 0
                                    ? "Aucune adresse trouvée. Cliquez pour en ajouter une."
                                    : selectedAddress
                                        ? `${selectedAddress.fullName}, ${selectedAddress.area}, ${selectedAddress.city}`
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
                                        key={address.id} // Clé basée sur l'ID numérique
                                        className="px-4 py-2 hover:bg-gray-100 cursor-pointer flex justify-between items-center"
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

                <div className="flex justify-between font-semibold border-t pt-4">
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
                    "Procéder au paiement avec Kkiapay"
                )}
            </button>
        </div>
    );
};

export default OrderSummary;
