// C:\xampp\htdocs\plawimadd_group\lib\types.ts

// IMPORTANT : Assurez-vous que tous les 'id' sont cohérents avec votre backend et next-auth.d.ts
// J'ai mis 'string' pour 'id' partout pour correspondre au next-auth.d.ts corrigé.
// Si vos IDs sont NUMERIQUES (auto-incrémentés par exemple), utilisez 'number' ou 'string | number' PARTOUT.

// --- Correction: Importation de useRouter est nécessaire car NextRouter l'utilise ---
import type { useRouter } from 'next/navigation';

// --- Définition des Enums ALIGNÉES AVEC schema.prisma ---
// Ces enums doivent correspondre exactement à celles définies dans votre prisma/schema.prisma
// pour assurer la cohérence des types entre le frontend et le backend via Prisma.

export enum OrderStatus {
    PENDING = 'PENDING',
    PAID_SUCCESS = 'PAID_SUCCESS',
    PAYMENT_FAILED = 'PAYMENT_FAILED',
    PROCESSING = 'PROCESSING',
    SHIPPED = 'SHIPPED',
    DELIVERED = 'DELIVERED',
    CANCELLED = 'CANCELLED',
}

export enum PaymentStatus {
    PENDING = 'PENDING',
    COMPLETED = 'COMPLETED',
    FAILED = 'FAILED',
    REFUNDED = 'REFUNDED',
}

export interface Product {
    id: string;
    name: string;
    description: string | null;
    price: number;
    offerPrice: number | null;
    stock: number;
    imgUrl: string[];
    createdAt: Date | string;
    updatedAt: Date | string;
    category: {
        id: string;
        name: string;
    };
    rating?: number | null;
    brand?: string | null;
    color?: string | null;
}

// Correction: Nouveau type pour la réponse de l'API produits, basé sur votre route.ts
export type ProductsApiResponse = { success: boolean; data: Product[] };

// NOUVEAU : Type pour la réponse de l'API des commandes (pour fetchUserOrders)
// Il peut s'agir d'un tableau direct d'Order, ou d'un objet avec une propriété 'data' ou 'orders'
export type OrdersApiResponse = { success: boolean; data: Order[] } | { orders: Order[] } | Order[];


export interface User {
    id: string;
    name?: string | null;
    email?: string | null;
    image?: string | null;
    firstName?: string;
    lastName?: string;
    role?: 'ADMIN' | 'USER';
    token?: string;
    phoneNumber?: string | null; // Rendre phoneNumber optionnel et nullable
}

// NOUVEAU : Type pour les articles de commande envoyés au backend (payload de création)
export interface OrderItemForCreatePayload {
    productId: string;
    quantity: number;
    price: number; // Le prix unitaire au moment de l'ajout au panier/checkout
}

// NOUVEAU : Type pour les articles de commande reçus du backend (pour affichage)
export interface OrderItemForDisplay {
    productId: string;
    quantity: number;
    priceAtOrder: number; // Le prix unitaire au moment où la commande a été passée (nombre)
    product: { // Détails du produit inclus depuis la relation Prisma
        name: string;
        imgUrl: string | null;
    };
}

export interface Address {
    id?: number; // L'ID d'adresse est un INT dans schema.prisma
    userId: string;
    fullName: string;
    phoneNumber: string;
    pincode: string | null;
    area: string;
    city: string;
    state: string;
    isDefault: boolean;
    street?: string;
    country?: string;
}

// Mise à jour : Utilise OrderItemForCreatePayload pour les items
export interface CreateOrderPayload {
    id: string; // L'ID de transaction Kkiapay généré par le frontend, qui sera aussi l'ID de la commande
    items: OrderItemForCreatePayload[]; // Utilise le nouveau type spécifique ici
    totalAmount: number;
    shippingAddress: Address; // Utilisation de Address pour la clarté
    paymentMethod: string;
    userEmail: string;
    userPhoneNumber: string | null; // Rendu nullable
    currency: string;
}

// Mise à jour : Utilise OrderItemForDisplay pour les items
export interface Order {
    id: string; // L'ID de la commande est le kkiapayTransactionId dans votre DB
    userId: string;
    totalAmount: number; // Maintenant un number, converti dans l'API
    status: OrderStatus;
    paymentStatus: PaymentStatus;
    shippingAddressLine1: string;
    shippingAddressLine2: string | null;
    shippingCity: string;
    shippingState: string;
    shippingZipCode: string | null;
    shippingCountry: string;
    userEmail: string;
    userPhoneNumber: string | null; // Rendu nullable
    currency: string;
    orderDate: Date | string;
    createdAt: Date | string;
    updatedAt: Date | string;
    shippingAddressId: number | null; // L'ID d'adresse est un INT dans schema.prisma
    orderItems: OrderItemForDisplay[]; // Utilise le nouveau type spécifique ici
    shippingAddress?: Address | null;
    // NOUVEAUX CHAMPS AJOUTÉS POUR LA RÉCUPÉRATION DES DÉTAILS DE PAIEMENT
    paymentMethod: string | null; // Méthode de paiement (ex: "Kkiapay")
    transactionId: string | null; // L'ID de transaction Kkiapay réel
}

export type NextRouter = ReturnType<typeof useRouter>;

export interface AppContextType {
    products: Product[];
    loadingProducts: boolean;
    errorProducts: string | null;
    searchTerm: string;
    setSearchTerm: (term: string) => void;
    selectedCategory: string;
    setSelectedCategory: (category: string) => void;
    filteredProducts: Product[];
    cartItems: Record<string, number>;
    addToCart: (productId: string) => Promise<boolean>;
    removeFromCart: (productId: string) => Promise<boolean>;
    deleteFromCart: (productId: string) => Promise<boolean>;
    updateCartQuantity: (productId: string, quantity: number) => Promise<boolean>;
    getCartCount: () => number;
    getCartAmount: () => number;
    currency: string;
    formatPrice: (price: number) => string;
    url: string;
    currentUser: User | null;
    setCurrentUser: (user: User | null) => void;
    isLoggedIn: boolean;
    userOrders: Order[];
    loadingOrders: boolean;
    errorFetchingOrders: string | null;
    userAddresses: Address[];
    loadingAddresses: boolean;
    errorFetchingAddresses: string | null;
    fetchUserOrders: () => Promise<void>;
    fetchUserAddresses: () => Promise<void>;
    router: NextRouter;
    clearCart: () => void;
    deliveryFee: number;
    setDeliveryFee: (fee: number) => void;
    loadCartData: () => Promise<void>;
    loadingCart: boolean;
    fetchProducts: () => Promise<void>;
}
