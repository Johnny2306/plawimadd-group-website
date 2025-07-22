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
    PAID_SUCCESS = 'PAID_SUCCESS', // Ajouté pour correspondre à schema.prisma
    PAYMENT_FAILED = 'PAYMENT_FAILED', // Ajouté pour correspondre à schema.prisma
    PROCESSING = 'PROCESSING',
    SHIPPED = 'SHIPPED',
    DELIVERED = 'DELIVERED',
    CANCELLED = 'CANCELLED',
    // REFUNDED a été supprimé ici s'il n'est pas dans schema.prisma OrderStatus
    // et déplacé vers PaymentStatus si c'est un statut de paiement.
}

export enum PaymentStatus {
    PENDING = 'PENDING',
    COMPLETED = 'COMPLETED', // Renommé de PAID pour correspondre à schema.prisma
    FAILED = 'FAILED',
    REFUNDED = 'REFUNDED',
}

// Correction de l'interface Product pour mieux correspondre à ClientProduct et aux données API
export interface Product {
    id: string;
    name: string;
    description: string | null; // Assurez-vous que c'est bien nullable
    price: number;
    offerPrice: number | null; // Assurez-vous que c'est bien nullable
    stock: number;
    imgUrl: string[]; // C'est un tableau de chaînes pour le client
    createdAt: Date | string; // Type Date ou string
    updatedAt: Date | string; // Type Date ou string
    category: { // Catégorie est un objet ici, comme dans ClientProduct
        id: string;
        name: string;
    };
    rating?: number | null; // Peut être undefined ou null
    brand?: string | null; // <-- MIS À JOUR : Peut être null
    color?: string | null; // <-- MIS À JOUR : Peut être null
}

export interface User {
    id: string;
    name?: string | null;
    email?: string | null;
    image?: string | null;
    firstName?: string;
    lastName?: string;
    role?: 'ADMIN' | 'USER';
    token?: string;
}

export interface OrderItem {
    productId: string;
    quantity: number;
    price: number;
    name: string;
    imgUrl: string; // Devrait être une chaîne unique pour un article de commande spécifique
}

export interface Address {
    id?: string; // L'API peut renvoyer _id ou id
    _id?: string; // Maintenu pour la flexibilité si votre API utilise _id
    fullName: string;
    phoneNumber: string;
    pincode: string | null; // <-- CORRIGÉ : Le code pin est maintenant optionnel/nullable
    area: string;
    city: string;
    state: string;
    isDefault: boolean;
    street?: string; // Optionnel, si votre backend le permet
    country?: string; // Optionnel, si votre backend le permet
}

export interface CreateOrderPayload {
    items: OrderItem[];
    totalAmount: number;
    shippingAddress: Address;
    paymentMethod: string;
    transactionId?: string;
    userEmail: string;
    userPhoneNumber: string;
    currency: string;
}

export interface Order {
    id: string;
    userId: string;
    totalAmount: number;
    kakapayTransactionId: string | null;
    status: OrderStatus; // Utilise l'enum défini
    paymentStatus: PaymentStatus; // Utilise l'enum défini
    shippingAddressLine1: string;
    shippingAddressLine2: string | null;
    shippingCity: string;
    shippingState: string;
    shippingZipCode: string | null;
    shippingCountry: string;
    userEmail: string;
    userPhoneNumber: string;
    currency: string;
    orderDate: Date | string; // Peut être Date ou string
    createdAt: Date | string; // Peut être Date ou string
    updatedAt: Date | string; // Peut être Date ou string
    shippingAddressId: string | null; // L'ID d'adresse est une string (UUID)
    orderItems: OrderItem[];
    shippingAddress?: Address | null;
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
    formatPrice: (price: number) => string; // <-- Nom de la fonction standardisé à 'formatPrice'
    url: string;
    currentUser: User | null;
    setCurrentUser: (user: User | null) => void;
    isLoggedIn: boolean;
    userOrders: Order[];
    loadingOrders: boolean;
    fetchUserOrders: () => Promise<void>;
    userAddresses: Address[];
    loadingAddresses: boolean;
    fetchUserAddresses: () => Promise<void>;
    router: NextRouter;
    deliveryFee: number;
    setDeliveryFee: (fee: number) => void;
    loadCartData: () => Promise<void>;
    loadingCart: boolean;
    fetchProducts: () => Promise<void>;
}
