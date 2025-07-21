// app/product/[id]/page.tsx
'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { assets } from '@/assets/assets';
import ProductCard from '@/components/ProductCard';
import Footer from '@/components/Footer';
import Image, { StaticImageData } from 'next/image';
import { useParams, useRouter } from 'next/navigation';
import Loading from '@/components/Loading';
import { useAppContext } from '@/context/AppContext';
import { useSession } from 'next-auth/react';
import { toast } from 'react-toastify';
import { Star } from 'lucide-react';
import { Product as ProductType } from '@/lib/types';

// Helper function to parse product image URLs
// This function is made more robust to handle various input formats,
// including stringified arrays, and ensures URLs are correctly formatted for Next.js Image component.
const parseProductImageUrls = (imgUrlInput: string[] | string | null | undefined): string[] => {
    if (!imgUrlInput) {
        return [];
    }

    let candidateUrls: string[] = [];

    if (Array.isArray(imgUrlInput)) {
        // If it's already an array, filter out non-string items
        candidateUrls = imgUrlInput.filter(item => typeof item === 'string') as string[];
    } else if (typeof imgUrlInput === 'string') {
        try {
            // Attempt to parse as JSON. This is crucial if your backend sends "[\"url1\", \"url2\"]"
            const parsed = JSON.parse(imgUrlInput);

            if (Array.isArray(parsed)) {
                // If parsed result is an array, filter for strings
                candidateUrls = parsed.filter(item => typeof item === 'string') as string[];
            } else if (typeof parsed === 'string') {
                // If parsed result is a single string (e.g., from JSON.parse("\"url\"")), use it
                candidateUrls = [parsed];
            } else {
                // If parsed but not a string or array (e.g., null, number, object),
                // treat the original input string as a single URL if it's not empty.
                if (imgUrlInput.trim() !== '') {
                    candidateUrls = [imgUrlInput];
                }
            }
        } catch (e) {
            // If JSON parsing fails (e.g., it's just a plain URL string, not JSON),
            // treat the original string as a single URL.
            if (imgUrlInput.trim() !== '') {
                candidateUrls = [imgUrlInput];
            }
        }
    }

    // Filter out any empty or invalid strings that might have slipped through
    // and ensure all remaining URLs are properly formatted for Next.js Image component.
    return candidateUrls.filter(url => url && url.trim() !== '').map(url => {
        // Aggressively remove any leading/trailing square brackets, quotes, and escaped quotes.
        // This regex targets:
        // - `^\["`: opening square bracket followed by a double quote at the start.
        // - `"]$`: double quote followed by a closing square bracket at the end.
        // - `^"|"$`: single double quote at the start or end.
        // - `\\"`: escaped double quotes anywhere.
        const cleanUrl = url.trim().replace(/^\["|"]$|^"|"$|\\"/g, '');

        // Ensure relative paths start with a leading slash.
        // If it's already a local path like "uploads/image.jpg", prepend a slash.
        if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://') && !cleanUrl.startsWith('/')) {
            return `/${cleanUrl}`;
        }
        return cleanUrl;
    });
};

/**
 * Composant de la page de détail d'un produit.
 * Affiche les informations détaillées d'un produit, permet d'ajouter au panier ou d'acheter directement.
 * @returns {React.ReactElement} Le JSX de la page de détail du produit.
 */
const Product = (): React.ReactElement | null => {
    const { id } = useParams<{ id: string }>();
    const router = useRouter();
    const { status } = useSession();
    const isLoggedIn: boolean = status === 'authenticated';

    const { addToCart, cartItems, products, formatPrice } = useAppContext();

    // mainImage peut être une StaticImageData (pour les assets locaux) ou une string (pour les URLs)
    const [mainImage, setMainImage] = useState<StaticImageData | string>(assets.default_product_image);
    const [productData, setProductData] = useState<ProductType | null>(null);
    const [loadingProductDetail, setLoadingProductDetail] = useState<boolean>(true);

    useEffect(() => {
        const fetchProductDetail = async () => {
            if (!id) {
                setLoadingProductDetail(false);
                return;
            }
            setLoadingProductDetail(true);
            try {
                const res = await fetch(`/api/products/${id}`);
                const data = await res.json();

                if (res.ok && data.success && data.product) {
                    const product: ProductType = data.product;
                    setProductData(product);

                    // Utilisation de la fonction helper pour charger les images
                    const loadedImageUrls = parseProductImageUrls(product.imgUrl);
                    setMainImage(loadedImageUrls.length > 0 ? loadedImageUrls[0] : assets.default_product_image);
                } else {
                    toast.error(data.message || 'Produit non trouvé.');
                    router.push('/');
                }
            } catch (error: unknown) {
                console.error('Erreur lors du chargement du produit:', error);
                toast.error('Erreur lors du chargement du produit.');
                router.push('/');
            } finally {
                setLoadingProductDetail(false);
            }
        };

        fetchProductDetail();
    }, [id, router]); // Dépendances : id pour refetch, router pour la navigation

    const handleAddToCart = async () => {
        if (!isLoggedIn) {
            toast.info('Connectez-vous pour ajouter au panier.');
            router.push('/login');
            return;
        }
        if (!productData) {
            toast.error('Impossible d\'ajouter au panier: Données produit manquantes.');
            return;
        }

        const alreadyInCart: number | undefined = cartItems?.[productData.id];
        if (alreadyInCart && alreadyInCart > 0) {
            toast.error('Produit déjà dans le panier.');
        } else {
            // Attendre le résultat de addToCart pour afficher le toast
            const success = await addToCart(productData.id);
            if (success) {
                toast.success('Ajouté au panier !');
            }
            // Le toast d'erreur est déjà géré par AppContext si l'opération échoue
        }
    };

    const handleBuyNow = async () => {
        if (!isLoggedIn) {
            toast.info('Connectez-vous pour commander.');
            router.push('/login');
            return;
        }
        if (!productData) {
            toast.error('Impossible de commander: Données produit manquantes.');
            return;
        }

        const alreadyInCart: number | undefined = cartItems?.[productData.id];
        let success = true; // Assume success if already in cart

        if (!alreadyInCart || alreadyInCart === 0) { // Si pas dans le panier ou quantité 0
            success = await addToCart(productData.id); // Add to cart and get success status
            if (success) {
                toast.success('Produit ajouté au panier !'); // Display toast if successfully added
            }
        }
        // Seulement rediriger si l'opération d'ajout au panier (si effectuée) a réussi
        if (success) {
            router.push('/cart');
        }
    };

    // Utilisation de useMemo pour mémoriser les URLs des images du produit.
    // Cela évite de recalculer la liste à chaque rendu si productData.imgUrl n'a pas changé.
    const productImageUrls: string[] = useMemo(() => {
        return parseProductImageUrls(productData?.imgUrl);
    }, [productData?.imgUrl]);

    if (loadingProductDetail) {
        return (
            <div className='flex-1 min-h-[calc(100vh-80px)] flex justify-center items-center bg-gray-50' aria-live="polite" aria-busy="true">
                <Loading />
            </div>
        );
    }

    if (!productData) {
        return (
            <div className='flex-1 min-h-[calc(100vh-80px)] flex flex-col items-center justify-center text-gray-700 p-4'>
                <p className='text-2xl font-semibold mb-4'>Produit non trouvé.</p>
                <button
                    onClick={() => router.push('/')}
                    className='px-6 py-3 bg-blue-600 text-white rounded-lg shadow-md hover:bg-blue-700 transition duration-300 ease-in-out'
                    aria-label="Retour à la page d'accueil"
                >
                    Retour à l&#39;accueil
                </button>
            </div>
        );
    }

    return (
        <>
            <div className='px-4 md:px-16 lg:px-32 py-8 md:py-14 space-y-12 bg-white min-h-[calc(100vh-80px)]'>
                <div className='grid grid-cols-1 md:grid-cols-2 gap-12 items-start'>
                    {/* IMAGE PRINCIPALE + MINIATURES */}
                    <div className='sticky top-24 px-4 lg:px-10'>
                        <div className='rounded-xl overflow-hidden bg-gray-100 border border-gray-200 mb-4 shadow-lg aspect-w-16 aspect-h-9 md:aspect-w-4 md:aspect-h-3 lg:aspect-w-16 lg:aspect-h-9'>
                            <Image
                                src={mainImage}
                                alt={productData.name}
                                className='w-full h-full object-contain p-4'
                                width={1280}
                                height={720}
                                priority
                                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                                onError={(e: React.SyntheticEvent<HTMLImageElement, Event>) => {
                                    const target = e.target as HTMLImageElement;
                                    target.onerror = null;
                                    target.src = assets.default_product_image.src;
                                }}
                            />
                        </div>
                        {productImageUrls.length > 0 && (
                            <div className='grid grid-cols-4 gap-3 mt-4'>
                                {productImageUrls.map((image: string, index: number) => (
                                    <div
                                        key={index}
                                        onClick={() => setMainImage(image)}
                                        className={`cursor-pointer rounded-lg overflow-hidden bg-gray-100 border-2 transition duration-200 ease-in-out
                                            ${mainImage === image ? 'border-blue-500 shadow-md scale-105' : 'border-transparent hover:border-blue-300'}
                                        `}
                                        role='button'
                                        tabIndex={0}
                                        onKeyDown={(e: React.KeyboardEvent<HTMLDivElement>) => {
                                            if (e.key === 'Enter' || e.key === ' ') {
                                                setMainImage(image);
                                            }
                                        }}
                                        aria-label={`Afficher l'image ${index + 1} du produit ${productData.name}`}
                                    >
                                        <Image
                                            src={image}
                                            alt={`${productData.name} - Vue ${index + 1}`}
                                            className='w-full h-20 object-contain p-1'
                                            width={120}
                                            height={120}
                                            onError={(e: React.SyntheticEvent<HTMLImageElement, Event>) => {
                                                const target = e.target as HTMLImageElement;
                                                target.onerror = null;
                                                target.src = assets.default_product_image.src;
                                            }}
                                        />
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* INFORMATIONS PRODUIT */}
                    <div className='flex flex-col p-4'>
                        <h1 className='text-4xl font-extrabold text-gray-900 mb-3 leading-tight'>
                            {productData.name}
                        </h1>
                        <div className='flex items-center gap-2 mb-4'>
                            <div className='flex items-center gap-1'>
                                {[...Array(5)].map((_, i: number) => (
                                    <Star
                                        key={i}
                                        size={24}
                                        className={`${
                                            i < Math.floor(productData.rating || 4.5)
                                                ? 'text-yellow-400 fill-yellow-400'
                                                : 'text-gray-300'
                                        }`}
                                        fill={i < Math.floor(productData.rating || 4.5) ? 'currentColor' : 'none'}
                                        aria-hidden='true'
                                    />
                                ))}
                            </div>
                            <p className='text-base text-gray-600 font-medium'>
                                ({(productData.rating || 4.5).toFixed(1)} / 5)
                            </p>
                        </div>
                        <p className='text-gray-700 leading-relaxed text-lg mb-6'>
                            {productData.description}
                        </p>
                        <p className='text-4xl font-bold text-gray-900 mb-2'>
                            {formatPrice(productData.offerPrice || productData.price)}
                            {productData.offerPrice && productData.offerPrice < productData.price && (
                                <span className='text-lg font-normal text-gray-500 line-through ml-3'>
                                    {formatPrice(productData.price)}
                                </span>
                            )}
                        </p>
                        {productData.offerPrice && productData.offerPrice < productData.price && (
                            <p className="text-green-600 font-semibold mb-6">
                                Économisez {formatPrice(productData.price - productData.offerPrice)} !
                            </p>
                        )}
                        <hr className='border-gray-300 my-6' />

                        <table className="w-full text-gray-700 text-lg mb-8">
                            <tbody>
                                <tr className="border-b border-gray-200">
                                    <td className='font-semibold py-3 pr-4'>Marque</td>
                                    <td className='py-3'>{productData.brand || 'Générique'}</td>
                                </tr>
                                <tr className="border-b border-gray-200">
                                    <td className='font-semibold py-3 pr-4'>Couleur</td>
                                    <td className='py-3'>{productData.color || 'Multicolore'}</td>
                                </tr>
                                <tr>
                                    <td className='font-semibold py-3 pr-4'>Catégorie</td>
                                    <td className='py-3'>{productData.category?.name || 'N/A'}</td>
                                </tr>
                            </tbody>
                        </table>

                        <div className='flex flex-col sm:flex-row mt-8 gap-4'>
                            <button
                                onClick={handleAddToCart}
                                className='flex-1 py-3 px-6 bg-gray-100 text-gray-800 font-semibold rounded-lg shadow-sm hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 transition duration-300 ease-in-out'
                                aria-label='Ajouter le produit au panier'
                            >
                                Ajouter au panier
                            </button>
                            <button
                                onClick={handleBuyNow}
                                className='flex-1 py-3 px-6 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 transition duration-300 ease-in-out'
                                aria-label='Acheter le produit maintenant'
                            >
                                Acheter maintenant
                            </button>
                        </div>
                    </div>
                </div>

                {/* PRODUITS SIMILAIRES */}
                <div className='text-center pt-16 pb-20 mt-16 bg-gray-50 rounded-lg shadow-inner'>
                    <h2 className='text-3xl font-extrabold text-gray-900 mb-10'>
                        Produits <span className='text-blue-600'>Similaires</span>
                    </h2>
                    <div className='mt-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6 px-4 md:px-8'>
                        {products.filter(p => p.id !== productData.id).slice(0, 5).map((product: ProductType) => (
                            <ProductCard
                                key={product.id}
                                product={product}
                            />
                        ))}
                    </div>
                </div>
            </div>
            <Footer />
        </>
    );
};

export default Product;
