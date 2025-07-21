// context/AppContext.tsx
'use client';

import React, {
    createContext,
    useContext,
    useState,
    useEffect,
    useCallback,
    ReactNode
} from 'react';
import axios from 'axios';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { toast } from 'react-toastify';

import {
    Product,
    Address,
    Order,
    User,
    AppContextType, // Assurez-vous que AppContextType est à jour dans lib/types.ts
} from '@/lib/types';

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider = ({ children }: { children: ReactNode }) => {
    const router = useRouter();
    const { data: session, status } = useSession();
    const url = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
    const currency = 'XOF' as const;

    const [products, setProducts] = useState<Product[]>([]);
    const [loadingProducts, setLoadingProducts] = useState(true);
    const [errorProducts, setErrorProducts] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('All');
    const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
    const [cartItems, setCartItems] = useState<Record<string, number>>({});
    const [loadingCart, setLoadingCart] = useState(true);
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [userOrders, setUserOrders] = useState<Order[]>([]);
    const [loadingOrders, setLoadingOrders] = useState(true);
    const [userAddresses, setUserAddresses] = useState<Address[]>([]);
    const [loadingAddresses, setLoadingAddresses] = useState(true);
    const [deliveryFee, setDeliveryFee] = useState(0);

    const formatPriceInFCFA = useCallback((price: number): string => {
        return new Intl.NumberFormat('fr-CM', {
            style: 'currency',
            currency: currency,
            minimumFractionDigits: 0,
        }).format(price);
    }, [currency]);

    useEffect(() => {
        console.log("[AppContext] Session status changed:", status);
        if (status === 'authenticated' && session?.user) {
            const userFromSession: User = {
                id: session.user.id,
                name: session.user.name || null,
                email: session.user.email || null,
                image: session.user.image || null,
                role: session.user.role || 'USER',
                token: session.user.token || '',
                firstName: session.user.firstName || '',
                lastName: session.user.lastName || ''
            };
            setCurrentUser(userFromSession);
            setIsLoggedIn(true);
            console.log("[AppContext] User authenticated:", userFromSession.id);
        } else if (status === 'unauthenticated') {
            console.log("[AppContext] User unauthenticated, clearing data.");
            setCurrentUser(null);
            setIsLoggedIn(false);
            setCartItems({});
            setUserOrders([]);
            setUserAddresses([]);
            localStorage.removeItem('cartItems');
        }
    }, [session, status]);

    const fetchProducts = useCallback(async () => {
        setLoadingProducts(true);
        setErrorProducts(null);
        try {
            const response = await axios.get<Product[]>(`${url}/api/products`);
            if (response.status === 200) {
                const validProducts = response.data.map(product => ({
                    ...product,
                    id: String(product.id),
                    // Ensure imgUrl is always an array for client-side consistency
                    imgUrl: Array.isArray(product.imgUrl)
                        ? product.imgUrl
                        : (product.imgUrl ? [product.imgUrl] : ['/placeholder.jpg'])
                }));
                setProducts(validProducts);
                setFilteredProducts(validProducts);
            }
        } catch (error: unknown) {
            console.error('Error fetching products:', error);
            setErrorProducts(
                axios.isAxiosError(error)
                    ? error.response?.data?.message || error.message
                    : (error instanceof Error ? error.message : 'Failed to load products')
            );
        } finally {
            setLoadingProducts(false);
        }
    }, [url]);

    const loadCartData = useCallback(async () => {
        setLoadingCart(true);
        if (isLoggedIn && currentUser?.id && currentUser?.token) {
            try {
                const response = await axios.get<{ cartItems: { productId: string; quantity: number }[] }>(
                    `${url}/api/cart/${currentUser.id}`,
                    { headers: { 'auth-token': currentUser.token } }
                );

                if (response.data?.cartItems) {
                    const normalizedCartItems: Record<string, number> = {};
                    response.data.cartItems.forEach(item => {
                        normalizedCartItems[String(item.productId)] = item.quantity;
                    });
                    setCartItems(normalizedCartItems);
                    localStorage.setItem('cartItems', JSON.stringify(normalizedCartItems));
                } else {
                    setCartItems({});
                    localStorage.removeItem('cartItems');
                }
            } catch (error: unknown) {
                console.error("Error loading cart from API:", error);
                if (axios.isAxiosError(error)) {
                    if (error.response?.status === 401) {
                        toast.error("Session expirée, veuillez vous reconnecter");
                        router.push('/login');
                    }
                }
                try {
                    const savedCart = localStorage.getItem('cartItems');
                    setCartItems(savedCart ? JSON.parse(savedCart) : {});
                    console.log("Loaded cart from localStorage after API error.");
                } catch (localError: unknown) {
                    console.error("Error loading cart from localStorage after API error", localError);
                    setCartItems({});
                }
            } finally {
                setLoadingCart(false);
            }
        } else {
            try {
                const savedCart = localStorage.getItem('cartItems');
                setCartItems(savedCart ? JSON.parse(savedCart) : {});
                console.log("Loaded cart from localStorage for unauthenticated user.");
            } catch (error: unknown) {
                console.error("Error loading cart from localStorage for unauthenticated user", error);
                setCartItems({});
            } finally {
                setLoadingCart(false);
            }
        }
    }, [isLoggedIn, currentUser?.id, currentUser?.token, url, router]);

    const updateCartOnServer = useCallback(async (productId: string, quantity: number): Promise<boolean> => {
        if (!isLoggedIn || !currentUser?.id || !currentUser?.token) {
            return false;
        }

        try {
            await axios.put(
                `${url}/api/cart/${currentUser.id}`,
                { productId, quantity },
                { headers: { 'auth-token': currentUser.token } }
            );
            return true;
        } catch (error: unknown) {
            console.error("Error updating cart on server:", error);
            const previousCart = JSON.parse(localStorage.getItem('cartItems') || '{}');
            setCartItems(previousCart);
            toast.error("Erreur de synchronisation du panier avec le serveur. Réessayez.");
            return false;
        }
    }, [url, isLoggedIn, currentUser?.id, currentUser?.token]);

    const addToCart = useCallback(async (productId: string): Promise<boolean> => {
        const idAsString = String(productId);
        const currentQuantity = cartItems[idAsString] || 0;
        const newQuantity = currentQuantity + 1;

        const newCart = { ...cartItems, [idAsString]: newQuantity };
        setCartItems(newCart);
        localStorage.setItem('cartItems', JSON.stringify(newCart));

        if (!isLoggedIn || !currentUser?.id || !currentUser?.token) {
            toast.info("Connectez-vous pour synchroniser votre panier.");
            return false;
        }

        try {
            const success = await updateCartOnServer(idAsString, newQuantity);
            if (success) {
                await loadCartData();
                return true;
            } else {
                await loadCartData();
                return false;
            }
        } catch (error: unknown) {
            toast.error("Erreur lors de l'ajout au panier. Veuillez réessayer.");
            await loadCartData();
            return false;
        }
    }, [cartItems, isLoggedIn, currentUser?.id, currentUser?.token, updateCartOnServer, loadCartData]);

    const removeFromCart = useCallback(async (productId: string): Promise<boolean> => {
        const idAsString = String(productId);
        const currentQuantity = cartItems[idAsString] || 0;

        if (currentQuantity <= 0) return false;

        const newQuantity = currentQuantity - 1;
        const newCart = { ...cartItems };

        if (newQuantity <= 0) {
            delete newCart[idAsString];
        } else {
            newCart[idAsString] = newQuantity;
        }

        setCartItems(newCart);
        localStorage.setItem('cartItems', JSON.stringify(newCart));

        if (!isLoggedIn || !currentUser?.id || !currentUser?.token) {
            toast.info("Connectez-vous pour synchroniser votre panier.");
            return false;
        }

        try {
            const success = await updateCartOnServer(idAsString, newQuantity);
            if (success) {
                await loadCartData();
                return true;
            } else {
                await loadCartData();
                return false;
            }
        } catch (error: unknown) {
            toast.error("Erreur lors de la mise à jour de la quantité. Veuillez réessayer.");
            await loadCartData();
            return false;
        }
    }, [cartItems, isLoggedIn, currentUser?.id, currentUser?.token, updateCartOnServer, loadCartData]);

    const deleteFromCart = useCallback(async (productId: string): Promise<boolean> => {
        const idAsString = String(productId);
        const newCart = { ...cartItems };
        delete newCart[idAsString];

        setCartItems(newCart);
        localStorage.setItem('cartItems', JSON.stringify(newCart));

        if (!isLoggedIn || !currentUser?.id || !currentUser?.token) {
            toast.info("Connectez-vous pour synchroniser votre panier.");
            return false;
        }

        try {
            const response = await axios.delete(`${url}/api/cart/${currentUser.id}`, {
                data: { productId: idAsString },
                headers: { 'auth-token': currentUser.token }
            });
            if (response.status === 200) {
                await loadCartData();
                toast.success("Produit retiré du panier.");
                return true;
            } else {
                toast.error("Erreur lors de la suppression du produit du panier. Veuillez réessayer.");
                await loadCartData();
                return false;
            }
        } catch (error: unknown) {
            toast.error("Erreur lors de la suppression du produit du panier. Veuillez réessayer.");
            await loadCartData();
            return false;
        }
    }, [cartItems, isLoggedIn, currentUser?.id, currentUser?.token, url, loadCartData]);

    const updateCartQuantity = useCallback(async (productId: string, quantity: number): Promise<boolean> => {
        const idAsString = String(productId);
        if (quantity < 0) return false;

        const newCart = { ...cartItems };
        if (quantity === 0) {
            delete newCart[idAsString];
        } else {
            newCart[idAsString] = quantity;
        }
        setCartItems(newCart);
        localStorage.setItem('cartItems', JSON.stringify(newCart));

        if (!isLoggedIn || !currentUser?.id || !currentUser?.token) {
            toast.info("Connectez-vous pour synchroniser votre panier.");
            return false;
        }

        try {
            const success = await updateCartOnServer(idAsString, quantity);
            if (success) {
                await loadCartData();
                return true;
            } else {
                await loadCartData();
                return false;
            }
        } catch (error: unknown) {
            toast.error("Erreur lors de la mise à jour de la quantité du panier. Veuillez réessayer.");
            await loadCartData();
            return false;
        }
    }, [cartItems, isLoggedIn, currentUser?.id, currentUser?.token, updateCartOnServer, loadCartData]);

    const getCartCount = useCallback(() =>
        Object.values(cartItems).reduce((sum, qty) => sum + qty, 0),
        [cartItems]
    );

    const getCartAmount = useCallback(() =>
        Object.entries(cartItems).reduce((total, [id, qty]) => {
            const product = products.find(p => p.id === id);
            return total + (product ? (product.offerPrice ?? product.price) * qty : 0);
        }, 0),
        [cartItems, products]
    );

    const fetchUserOrders = useCallback(async () => {
        if (!isLoggedIn || !currentUser?.id || !currentUser?.token) {
            setUserOrders([]);
            setLoadingOrders(false);
            console.log("[AppContext] fetchUserOrders: User not logged in or missing ID/token, skipping fetch.");
            return;
        }

        setLoadingOrders(true);
        console.log(`[AppContext] fetchUserOrders: Fetching orders for user ${currentUser.id}...`);
        try {
            const response = await axios.get<Order[]>(`${url}/api/user/orders`, {
                headers: { 'auth-token': currentUser.token }
            });
            console.log("[AppContext] fetchUserOrders: API response received:", response.data);
            setUserOrders(response.data || []);
        } catch (error: unknown) {
            console.error("Error fetching orders:", error);
            setUserOrders([]);
            if (axios.isAxiosError(error)) {
                if (error.response?.status === 401) {
                    toast.error("Session expirée, veuillez vous reconnecter");
                    router.push('/login');
                }
            }
        } finally {
            setLoadingOrders(false);
            console.log("[AppContext] fetchUserOrders: Loading finished.");
        }
    }, [url, isLoggedIn, currentUser?.id, currentUser?.token, router]);

    const fetchUserAddresses = useCallback(async () => {
        if (!isLoggedIn || !currentUser?.id || !currentUser?.token) {
            setUserAddresses([]);
            setLoadingAddresses(false);
            console.log("[AppContext] fetchUserAddresses: User not logged in or missing ID/token, skipping fetch.");
            return;
        }

        setLoadingAddresses(true);
        console.log(`[AppContext] fetchUserAddresses: Fetching addresses for user ${currentUser.id}...`);
        try {
            const response = await axios.get<{ success: boolean; addresses: Address[] }>( // Adjusted type for API response
                `${url}/api/addresses/${currentUser.id}`,
                { headers: { 'auth-token': currentUser.token } }
            );
            console.log("[AppContext] fetchUserAddresses: API response received:", response.data);
            if (response.data.success && Array.isArray(response.data.addresses)) {
                setUserAddresses(response.data.addresses);
                console.log("[AppContext] fetchUserAddresses: Addresses set:", response.data.addresses);
            } else {
                console.warn("[AppContext] fetchUserAddresses: API response was not successful or addresses not an array.", response.data);
                setUserAddresses([]);
            }
        } catch (error: unknown) {
            console.error("Error fetching addresses:", error);
            setUserAddresses([]);
            if (axios.isAxiosError(error)) {
                if (error.response?.status === 401) {
                    toast.error("Session expirée, veuillez vous reconnecter");
                    router.push('/login');
                }
            }
        } finally {
            setLoadingAddresses(false);
            console.log("[AppContext] fetchUserAddresses: Loading finished.");
        }
    }, [url, isLoggedIn, currentUser?.id, currentUser?.token, router]);

    useEffect(() => {
        const filtered = products.filter(product => {
            const matchesCategory = selectedCategory === 'All' || product.category.name === selectedCategory;
            const matchesSearch = searchTerm === '' ||
                product.name.toLowerCase().includes(searchTerm.toLowerCase());
            return matchesCategory && matchesSearch;
        });
        setFilteredProducts(filtered);
    }, [products, searchTerm, selectedCategory]);

    useEffect(() => {
        console.log("[AppContext] Main useEffect triggered.");
        fetchProducts();
    }, [fetchProducts]);

    // Cet useEffect est crucial pour déclencher les chargements spécifiques à l'utilisateur
    useEffect(() => {
        console.log("[AppContext] User-specific data useEffect triggered. isLoggedIn:", isLoggedIn, "currentUser.id:", currentUser?.id);
        if (isLoggedIn && currentUser?.id) {
            loadCartData();
            fetchUserOrders();
            fetchUserAddresses(); // Appelé ici
        }
    }, [isLoggedIn, currentUser?.id, loadCartData, fetchUserOrders, fetchUserAddresses]);

    const contextValue: AppContextType = {
        products,
        loadingProducts,
        errorProducts,
        searchTerm,
        setSearchTerm,
        selectedCategory,
        setSelectedCategory,
        filteredProducts,
        cartItems,
        loadingCart,
        currentUser,
        setCurrentUser,
        isLoggedIn,
        userOrders,
        loadingOrders,
        userAddresses,
        loadingAddresses,
        deliveryFee,
        setDeliveryFee,
        fetchProducts,
        loadCartData,
        addToCart,
        removeFromCart,
        deleteFromCart,
        updateCartQuantity,
        getCartCount,
        getCartAmount,
        formatPrice: formatPriceInFCFA,
        fetchUserOrders,
        fetchUserAddresses,
        router,
        currency,
        url,
    };

    return (
        <AppContext.Provider value={contextValue}>
            {children}
        </AppContext.Provider>
    );
};

export const useAppContext = () => {
    const context = useContext(AppContext);
    if (!context) {
        throw new Error('useAppContext must be used within AppProvider');
    }
    return context;
};
