// app/cart/page.tsx
'use client';

import React, { ChangeEvent } from "react"; // Importez ChangeEvent
import { assets } from "@/assets/assets";
import OrderSummary from "@/components/OrderSummary";
import Image from "next/image";
import { useAppContext } from "@/context/AppContext";
import { FiArrowLeft, FiTrash2, FiPlus, FiMinus } from "react-icons/fi";
import { Product } from '@/lib/types'; // Importez l'interface Product

/**
 * Composant de la page du panier.
 * Affiche les articles ajoutés au panier, permet de modifier les quantités, de supprimer des articles
 * et affiche un résumé de la commande.
 * @returns {React.ReactElement} Le JSX de la page du panier.
 */
const Cart = (): React.ReactElement => {
    const {
        products,
        router,
        cartItems,
        addToCart,
        removeFromCart,
        deleteFromCart,
        updateCartQuantity,
        getCartCount,
        formatPrice
    } = useAppContext();

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="container mx-auto px-4 py-8">
                <div className="flex flex-col lg:flex-row gap-8">
                    {/* Cart Items Section */}
                    <div className="lg:w-2/3">
                        <div className="bg-white rounded-lg shadow-sm p-6">
                            <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-100">
                                <h2 className="text-xl md:text-2xl font-bold text-gray-800">
                                    Votre <span className="text-blue-600">Panier</span>
                                </h2>
                                <p className="text-sm md:text-base text-gray-500">
                                    {getCartCount()} {getCartCount() > 1 ? 'Articles' : 'Article'}
                                </p>
                            </div>

                            {/* Mobile Cart Items */}
                            <div className="lg:hidden space-y-6">
                                {Object.keys(cartItems).map((itemId: string) => {
                                    const product = products.find((p: Product) => String(p.id) === itemId);
                                    if (!product || cartItems[itemId] <= 0) return null;

                                    const productImageUrls = Array.isArray(product.imgUrl) ? product.imgUrl : [];
                                    const priceToDisplay = product.offerPrice || product.price;

                                    return (
                                        <div key={itemId} className="bg-gray-50 rounded-lg p-4">
                                            <div className="flex justify-between">
                                                <div className="flex items-start gap-4">
                                                    <div className="rounded-lg overflow-hidden bg-gray-100">
                                                        <Image
                                                            src={productImageUrls[0] || assets.default_product_image}
                                                            alt={product.name}
                                                            className="w-16 h-16 object-cover"
                                                            width={64}
                                                            height={64}
                                                            priority
                                                        />
                                                    </div>
                                                    <div>
                                                        <p className="font-medium text-gray-800">{product.name}</p>
                                                        <p className="text-sm text-gray-600 mt-1">
                                                            {formatPrice(priceToDisplay)}
                                                        </p>
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => deleteFromCart(product.id)}
                                                    className="text-gray-400 hover:text-red-500"
                                                    title="Supprimer l'article"
                                                    aria-label="Supprimer l'article"
                                                >
                                                    <FiTrash2 size={18} />
                                                </button>
                                            </div>

                                            <div className="flex items-center justify-between mt-4">
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        onClick={() => removeFromCart(product.id)}
                                                        className="p-1 rounded-full bg-gray-200 text-gray-600 hover:bg-gray-300"
                                                        title="Retirer une unité"
                                                        aria-label="Retirer une unité"
                                                    >
                                                        <FiMinus size={16} />
                                                    </button>
                                                    <input
                                                        type="number"
                                                        value={cartItems[itemId]}
                                                        onChange={(e: ChangeEvent<HTMLInputElement>) => updateCartQuantity(product.id, Number(e.target.value))}
                                                        className="w-12 border rounded-md text-center py-1"
                                                        min="1"
                                                        title="Quantité du produit"
                                                        placeholder="Quantité"
                                                    />
                                                    <button
                                                        onClick={() => addToCart(product.id)}
                                                        className="p-1 rounded-full bg-gray-200 text-gray-600 hover:bg-gray-300"
                                                        title="Ajouter une unité"
                                                        aria-label="Ajouter une unité"
                                                    >
                                                        <FiPlus size={16} />
                                                    </button>
                                                </div>
                                                <p className="font-medium text-gray-800">
                                                    {formatPrice(priceToDisplay * cartItems[itemId])}
                                                </p>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Desktop Cart Items */}
                            <div className="hidden lg:block">
                                <table className="w-full">
                                    <thead className="text-left bg-gray-50">
                                        <tr>
                                            <th className="py-4 px-4 text-sm font-medium text-gray-500">Produit</th>
                                            <th className="py-4 px-4 text-sm font-medium text-gray-500">Prix</th>
                                            <th className="py-4 px-4 text-sm font-medium text-gray-500">Quantité</th>
                                            <th className="py-4 px-4 text-sm font-medium text-gray-500">Total</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {Object.keys(cartItems).map((itemId: string) => {
                                            const product = products.find((p: Product) => String(p.id) === itemId);
                                            if (!product || cartItems[itemId] <= 0) return null;

                                            const productImageUrls = Array.isArray(product.imgUrl) ? product.imgUrl : [];
                                            const priceToDisplay = product.offerPrice || product.price;

                                            return (
                                                <tr key={itemId}>
                                                    <td className="py-4 px-4">
                                                        <div className="flex items-center gap-4">
                                                            <div className="rounded-lg overflow-hidden bg-gray-100">
                                                                <Image
                                                                    src={productImageUrls[0] || assets.default_product_image}
                                                                    alt={product.name}
                                                                    className="w-16 h-16 object-cover"
                                                                    width={64}
                                                                    height={64}
                                                                    priority
                                                                />
                                                            </div>
                                                            <div>
                                                                <p className="font-medium text-gray-800">{product.name}</p>
                                                                <button
                                                                    onClick={() => deleteFromCart(product.id)}
                                                                    className="text-sm text-blue-600 hover:text-blue-800 mt-1"
                                                                    title="Supprimer l'article"
                                                                    aria-label="Supprimer l'article"
                                                                >
                                                                    Supprimer
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="py-4 px-4 text-gray-600">
                                                        {formatPrice(priceToDisplay)}
                                                    </td>
                                                    <td className="py-4 px-4">
                                                        <div className="flex items-center gap-2">
                                                            <button
                                                                onClick={() => removeFromCart(product.id)}
                                                                className="p-1 rounded-full bg-gray-200 text-gray-600 hover:bg-gray-300"
                                                                title="Retirer une unité"
                                                                aria-label="Retirer une unité"
                                                            >
                                                                <FiMinus size={16} />
                                                            </button>
                                                            <input
                                                                type="number"
                                                                value={cartItems[itemId]}
                                                                onChange={(e: ChangeEvent<HTMLInputElement>) => updateCartQuantity(product.id, Number(e.target.value))}
                                                                className="w-12 border rounded-md text-center py-1"
                                                                min="1"
                                                                title="Quantité du produit"
                                                                placeholder="Quantité"
                                                            />
                                                            <button
                                                                onClick={() => addToCart(product.id)}
                                                                className="p-1 rounded-full bg-gray-200 text-gray-600 hover:bg-gray-300"
                                                                title="Ajouter une unité"
                                                                aria-label="Ajouter une unité"
                                                            >
                                                                <FiPlus size={16} />
                                                            </button>
                                                        </div>
                                                    </td>
                                                    <td className="py-4 px-4 font-medium text-gray-800">
                                                        {formatPrice(priceToDisplay * cartItems[itemId])}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>

                            <button
                                onClick={() => router.push('/all-products')}
                                className="flex items-center mt-6 text-blue-600 hover:text-blue-800 transition-colors"
                            >
                                <FiArrowLeft className="mr-2" />
                                Continuer vos achats
                            </button>
                        </div>
                    </div>

                    {/* Order Summary Section - Always visible but sticky on mobile */}
                    <div className="lg:w-1/3">
                        <div className="sticky top-4">
                            <OrderSummary />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Cart;