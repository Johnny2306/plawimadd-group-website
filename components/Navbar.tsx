// components/Navbar.tsx
'use client';

import React, { useState, useRef, useEffect } from "react";
import { assets } from "@/assets/assets";
import Link from "next/link";
import Image from "next/image";
import { useAppContext } from "@/context/AppContext";
import { usePathname, useRouter } from "next/navigation";
import { useSession, signOut } from 'next-auth/react';
// L'importation de 'Session' de 'next-auth' est utile pour la clarté,
// mais les extensions de type sont faites via next-auth.d.ts


// Import React Icons
import {
    FaSearch,
    FaUser,
    FaHome,
    FaShoppingBag,
    FaGift,
    FaEnvelope,
    FaBars,
    FaTimes,
    FaSignInAlt,
    FaUserPlus,
    FaShoppingCart,
    FaSignOutAlt,
} from "react-icons/fa";
import { MdOutlineDashboard } from "react-icons/md";

// --- CETTE INTERFACE CustomSession N'EST PLUS NÉCESSAIRE ET DOIT ÊTRE SUPPRIMÉE OU COMMENTÉE ---
// C'est le rôle de 'next-auth.d.ts' d'étendre les types globaux.
// interface CustomSession extends Session {
//     user?: {
//         name?: string | null;
//         email?: string | null;
//         image?: string | null;
//         firstName?: string | null;
//         role?: 'ADMIN' | 'SELLER' | 'USER';//     };
// }
// --- FIN DE LA SUPPRESSION/COMMENTAIRE ---

// Define the shape of the AppContext values used in this component
interface AppContextType {
    searchTerm: string;
    setSearchTerm: (term: string) => void;
    getCartCount: () => number;
}

const Navbar = () => {
    const { searchTerm, setSearchTerm, getCartCount } = useAppContext() as AppContextType;
    const pathname = usePathname();
    const router = useRouter();

    const { data: session, status } = useSession();

    const isLoggedIn: boolean = status === 'authenticated';
    // Mettez à jour la logique pour 'isAdmin' et supprimez 'isSeller'
    const isAdmin: boolean = isLoggedIn && session?.user?.role === 'ADMIN';
    // const isSeller: boolean = isLoggedIn && session?.user?.role === 'SELLER'; // <-- SUPPRIMEZ OU COMMENTEZ CETTE LIGNE

    const userFullName: string =
        session?.user?.name ||
        session?.user?.firstName ||
        (session?.user?.email ? session.user.email.split('@')[0] : '');
    const userInitial: string = userFullName ? userFullName.charAt(0).toUpperCase() : '';

    const getAvatarColorClass = (initial: string): string => {
        const colors: string[] = [
            'bg-blue-500', 'bg-green-500', 'bg-red-500', 'bg-purple-500',
            'bg-yellow-500', 'bg-indigo-500', 'bg-pink-500', 'bg-teal-500'
        ];
        if (!initial) return 'bg-gray-400';
        const index: number = initial.charCodeAt(0) % colors.length;
        return colors[index];
    };

    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);
    const [isDesktopSearchInputVisible, setIsDesktopSearchInputVisible] = useState<boolean>(false);
    const [isAccountDropdownOpen, setIsAccountDropdownOpen] = useState<boolean>(false);
    const [showLogoutOverlay, setShowLogoutOverlay] = useState<boolean>(false);

    const accountButtonRef = useRef<HTMLDivElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const cartIconRef = useRef<HTMLAnchorElement>(null);
    const desktopSearchInputRef = useRef<HTMLInputElement>(null);

    const [animateCart, setAnimateCart] = useState<boolean>(false);
    const prevCartItemCount = useRef<number>(0);

    useEffect(() => {
        const currentCartCount: number = getCartCount();
        if (currentCartCount > 0 && currentCartCount !== prevCartItemCount.current) {
            setAnimateCart(true);
            const timer = setTimeout(() => {
                setAnimateCart(false);
            }, 500);
            return () => clearTimeout(timer);
        }
        prevCartItemCount.current = currentCartCount;
    }, [getCartCount]);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (
                accountButtonRef.current &&
                !accountButtonRef.current.contains(event.target as Node) &&
                dropdownRef.current &&
                !dropdownRef.current.contains(event.target as Node)
            ) {
                setIsAccountDropdownOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [accountButtonRef, dropdownRef]);

    useEffect(() => {
        if (pathname === '/all-products' && searchTerm) {
            setIsDesktopSearchInputVisible(true);
        }
        if (isDesktopSearchInputVisible && desktopSearchInputRef.current) {
            desktopSearchInputRef.current.focus();
        }
    }, [pathname, searchTerm, isDesktopSearchInputVisible]);

    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchTerm(e.target.value);
        if (pathname !== '/all-products') {
            router.push('/all-products');
        }
    };

    const toggleDesktopSearchVisibility = () => {
        if (isDesktopSearchInputVisible) {
            setSearchTerm('');
        }
        setIsDesktopSearchInputVisible(prev => !prev);
    };

    const getLinkClassName = (href: string): string => {
        const baseClasses: string = "hover:text-gray-900 transition";
        const activeClasses: string = "text-blue-600 font-semibold";
        if (href === "/" && pathname === "/") {
            return `${baseClasses} ${activeClasses}`;
        }
        if (href !== "/" && pathname.startsWith(href)) {
            return `${baseClasses} ${activeClasses}`;
        }
        return baseClasses;
    };

    const getMobileMenuItemClassName = (href: string): string => {
        const baseClasses: string =
            "flex items-center gap-3 text-lg w-full py-2 px-3 rounded-md transition duration-200 ease-in-out";
        const activeClasses: string = "bg-indigo-100 text-indigo-700 font-semibold";
        const hoverClasses: string = "hover:bg-zinc-200 hover:text-zinc-950";
        if (href === "/" && pathname === "/") {
            return `${baseClasses} ${activeClasses}`;
        }
        if (href !== "/" && pathname.startsWith(href)) {
            return `${baseClasses} ${activeClasses}`;
        }
        return `${baseClasses} ${hoverClasses}`;
    };

    const handleLogoutConfirmation = (): void => {
        setIsAccountDropdownOpen(false);
        setIsMobileMenuOpen(false);
        setShowLogoutOverlay(true);
    };

    const confirmLogout = async (): Promise<void> => {
        setShowLogoutOverlay(false);
        await signOut({ callbackUrl: '/' });
    };

    const cancelLogout = (): void => {
        setShowLogoutOverlay(false);
    };

    return (
        <>
            {/* Logout Confirmation Overlay */}
            {showLogoutOverlay && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white p-6 rounded-lg shadow-lg">
                        <h3 className="text-lg font-semibold mb-4">Confirmation de déconnexion</h3>
                        <p className="mb-6">Êtes-vous sûr de vouloir vous déconnecter ?</p>
                        <div className="flex justify-end gap-3">
                            <button
                                onClick={cancelLogout}
                                className="px-4 py-2 bg-gray-300 text-gray-800 rounded-md hover:bg-gray-400 transition-colors"
                            >
                                Annuler
                            </button>
                            <button
                                onClick={confirmLogout}
                                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
                            >
                                Déconnexion
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <nav className="flex items-center justify-between px-6 md:px-16 lg:px-32 py-3 border-b bg-zinc-100 text-zinc-950 relative z-30">
                {/* Logo (Left side) */}
                <Link href="/">
                    <Image
                        src={assets.logo}
                        alt="Logo"
                        // AJOUTÉ: width et height sont requis pour next/image
                        // Ajustez ces valeurs selon les dimensions réelles de votre logo ou la taille souhaitée.
                        width={180} // Exemple: ajustez à la largeur réelle ou souhaitée
                        height={60} // Exemple: ajustez à la hauteur réelle ou souhaitée
                        className="w-[120px] md:w-[150px] lg:w-[180px] hover:scale-105 transition-transform"
                        priority={true}
                    />
                </Link>

                {/* Desktop Navigation Links (Middle) */}
                <div className="hidden md:flex items-center gap-4 lg:gap-8 text-zinc-950">
                    <div className="p-2 hover:bg-zinc-200 rounded-3xl hover:scale-105 transition-transform hover:font-semibold">
                        <Link href="/" className={getLinkClassName("/")}>
                            Accueil
                        </Link>
                    </div>
                    <div className="p-2 hover:bg-zinc-200 rounded-3xl hover:scale-105 transition-transform hover:font-semibold">
                        <Link
                            href="/all-products"
                            className={getLinkClassName("/all-products")}
                        >
                            Boutique
                        </Link>
                    </div>
                    <div className="p-2 hover:bg-zinc-200 rounded-3xl hover:scale-105 transition-transform hover:font-semibold">
                        <Link href="/offer" className={getLinkClassName("/offer")}>
                            Offres
                        </Link>
                    </div>
                    <div className="p-2 hover:bg-zinc-200 rounded-3xl hover:scale-105 transition-transform hover:font-semibold">
                        <Link href="/contact" className={getLinkClassName("/contact")}>
                            Contact
                        </Link>
                    </div>

                    {/* Conditional rendering for Admin Dashboard links on Desktop */}
                    {status !== 'loading' && (
                        <>
                            {isAdmin && ( // Maintenant, seul l'admin a accès au tableau de bord /seller
                                <button
                                    onClick={() => router.push("/seller")}
                                    className="text-xs border px-4 py-1.5 rounded-full hover:text-semibold hover:scale-105 transition-transform border-zinc-950 text-zinc-950 hover:bg-zinc-950 hover:text-zinc-50"
                                >
                                    Tableau de bord (Admin)
                                </button>
                            )}
                            {/* SUPPRIMEZ OU COMMENTEZ LE BLOC 'isSeller' POUR LE BUREAU */}
                            {/* {!isAdmin && isSeller && (
                                <button
                                    onClick={() => router.push("/seller")}
                                    className="text-xs border px-4 py-1.5 rounded-full hover:text-semibold hover:scale-105 transition-transform border-zinc-950 text-zinc-950 hover:bg-zinc-950 hover:text-zinc-50"
                                >
                                    Tableau de bord (Vendeur)
                                </button>
                            )} */}
                        </>
                    )}
                </div>

                {/* Desktop Icons (Right side) */}
                <div className="hidden md:flex items-center gap-4">
                    {/* Shopping Cart Icon (visible only if logged in and status is not loading) */}
                    {status !== 'loading' && (
                        <Link href="/cart" className={`relative cursor-pointer group ${!isLoggedIn ? 'hidden' : ''}`} ref={cartIconRef}>
                            <FaShoppingCart className="w-6 h-6 text-gray-700 hover:scale-105 hover:text-blue-700 transition-transform" />
                            {getCartCount() > 0 && (
                                <span className={`absolute -top-2 -right-2 bg-red-600 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center ${animateCart ? 'animate-bounce-once' : ''}`}>
                                    {getCartCount()}
                                </span>
                            )}
                            <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-gray-800 text-white text-xs rounded-md opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none whitespace-nowrap">
                                Mon Panier
                            </span>
                        </Link>
                    )}

                    {/* Desktop Search Input */}
                    <div className="relative">
                        <FaSearch
                            className="w-5 h-5 cursor-pointer text-gray-700 hover:scale-105 hover:text-blue-700 transition-transform"
                            onClick={toggleDesktopSearchVisibility}
                        />
                        {isDesktopSearchInputVisible && (
                            <input
                                type="text"
                                placeholder="Rechercher..."
                                value={searchTerm}
                                onChange={handleSearchChange}
                                ref={desktopSearchInputRef}
                                className="absolute right-0 top-full mt-2 p-2 border border-gray-300 rounded-md shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-500 z-10 bg-white text-zinc-950"
                                onBlur={() => {
                                    if (!searchTerm) {
                                        setIsDesktopSearchInputVisible(false);
                                    }
                                }}
                                autoFocus
                            />
                        )}
                    </div>

                    {/* Account Button/Dropdown */}
                    <div className="relative" ref={accountButtonRef}> {/* ref est sur la div ici */}
                        {status !== 'loading' ? (
                            <button
                                onClick={() => setIsAccountDropdownOpen(!isAccountDropdownOpen)}
                                className={`flex items-center justify-center p-2 rounded-full transition-transform focus:outline-none relative group
                                    ${isLoggedIn ? `${getAvatarColorClass(userInitial)} text-white w-9 h-9 text-lg font-bold hover:scale-110` : 'text-zinc-950 hover:bg-zinc-200 w-auto'}`}
                                title={isLoggedIn && userFullName ? userFullName : "Mon Compte"}
                            >
                                {isLoggedIn ? (
                                    userInitial || <FaUser className="w-5 h-5" />
                                ) : (
                                    <>
                                        <FaUser className="w-5 h-5 mr-2" />
                                        <span>Compte</span>
                                    </>
                                )}
                                {isLoggedIn && userFullName && (
                                    <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-gray-800 text-white text-xs rounded-md opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none whitespace-nowrap">
                                        {userFullName}
                                    </span>
                                )}
                            </button>
                        ) : (
                            <div className="w-9 h-9 bg-gray-300 rounded-full animate-pulse"></div>
                        )}

                        {isAccountDropdownOpen && (
                            <div
                                ref={dropdownRef}
                                className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-md shadow-lg py-1 z-20"
                            >
                                {status !== 'loading' ? (
                                    !isLoggedIn ? (
                                        <>
                                            <Link href="/register"
                                                className="flex items-center gap-2 px-4 py-2 text-gray-700 hover:bg-gray-100 w-full text-left"
                                                onClick={() => setIsAccountDropdownOpen(false)}
                                            >
                                                <FaUserPlus className="w-4 h-4" />
                                                S&#39;inscrire
                                            </Link>
                                            <Link href="/login"
                                                className="flex items-center gap-2 px-4 py-2 text-gray-700 hover:bg-gray-100 w-full text-left"
                                                onClick={() => setIsAccountDropdownOpen(false)}
                                            >
                                                <FaSignInAlt className="w-4 h-4" />
                                                Se connecter
                                            </Link>
                                        </>
                                    ) : (
                                        <>
                                            <div className="px-4 py-2 border-b border-gray-200 text-sm">
                                                <p className="font-semibold text-gray-800">{userFullName}</p>
                                                <p className="text-gray-500 truncate">{session?.user?.email}</p>
                                            </div>
                                            <Link href="/cart"
                                                className="flex items-center gap-2 px-4 py-2 text-gray-700 hover:bg-gray-100 w-full text-left"
                                                onClick={() => setIsAccountDropdownOpen(false)}
                                            >
                                                <FaShoppingCart className="w-4 h-4" />
                                                Mon Panier
                                            </Link>
                                            <Link href="/my-orders"
                                                className="flex items-center gap-2 px-4 py-2 text-gray-700 hover:bg-gray-100 w-full text-left"
                                                onClick={() => setIsAccountDropdownOpen(false)}
                                            >
                                                <FaShoppingBag className="w-4 h-4" />
                                                Mes Commandes
                                            </Link>
                                            {isAdmin && ( // Maintenant, seul l'admin a accès au tableau de bord /seller
                                                <Link href="/seller"
                                                    className="flex items-center gap-2 px-4 py-2 text-gray-700 hover:bg-gray-100 w-full text-left"
                                                    onClick={() => setIsAccountDropdownOpen(false)}
                                                >
                                                    <MdOutlineDashboard className="w-4 h-4" />
                                                    Tableau de bord (Admin)
                                                </Link>
                                            )}
                                            {/* SUPPRIMEZ OU COMMENTEZ LE BLOC 'isSeller' DANS LE DROPDOWN */}
                                            {/* {!isAdmin && isSeller && (
                                                <Link href="/seller"
                                                    className="flex items-center gap-2 px-4 py-2 text-gray-700 hover:bg-gray-100 w-full text-left"
                                                    onClick={() => setIsAccountDropdownOpen(false)}
                                                >
                                                    <MdOutlineDashboard className="w-4 h-4" />
                                                    Tableau de bord (Vendeur)
                                                </Link>
                                            )} */}
                                            <button
                                                onClick={handleLogoutConfirmation}
                                                className="flex items-center gap-2 px-4 py-2 text-red-600 hover:bg-red-50 w-full text-left"
                                            >
                                                <FaSignOutAlt className="w-4 h-4" />
                                                Déconnexion
                                            </button>
                                        </>
                                    )
                                ) : (
                                    <div className="px-4 py-2 text-gray-500">Chargement...</div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Mobile Hamburger Icon */}
                <div className="md:hidden flex items-center gap-3">
                    {/* Mobile Shopping Cart Icon (visible only if logged in and status is not loading) */}
                    {status !== 'loading' && (
                        <Link href="/cart" className={`relative cursor-pointer group ${!isLoggedIn ? 'hidden' : ''}`}>
                            <FaShoppingCart className="w-7 h-7 text-gray-700 hover:scale-105 hover:text-blue-700 transition-transform" />
                            {getCartCount() > 0 && (
                                <span className={`absolute -top-2 -right-2 bg-red-600 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center ${animateCart ? 'animate-bounce-once' : ''}`}>
                                    {getCartCount()}
                                </span>
                            )}
                        </Link>
                    )}
                    <button
                        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                        className="p-2 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                        {isMobileMenuOpen ? (
                            <FaTimes className="w-7 h-7 text-zinc-950" />
                        ) : (
                            <FaBars className="w-7 h-7 text-zinc-950" />
                        )}
                    </button>
                </div>

                {/* Mobile Menu Overlay */}
                {isMobileMenuOpen && (
                    <div className="md:hidden absolute top-full left-0 w-full bg-zinc-100 border-b shadow-lg z-20 flex flex-col items-start px-6 py-4 space-y-2 animate-fade-in-down">
                        {/* Mobile Search Input */}
                        <div className="w-full mb-4">
                            <div className="relative">
                                <FaSearch className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                                <input
                                    type="text"
                                    placeholder="Rechercher..."
                                    value={searchTerm}
                                    onChange={handleSearchChange}
                                    className="w-full p-2 pl-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-zinc-950"
                                />
                            </div>
                        </div>

                        {status !== 'loading' && (
                            <>
                                {isLoggedIn && (
                                    <div className="w-full px-3 py-2 border-b border-gray-200 text-sm mb-2">
                                        <p className="font-semibold text-gray-800">{userFullName}</p>
                                        <p className="text-gray-500 truncate">{session?.user?.email}</p>
                                    </div>
                                )}

                                {/* Mobile Navigation Links with Icons */}
                                <Link
                                    href="/"
                                    className={getMobileMenuItemClassName("/")}
                                    onClick={() => setIsMobileMenuOpen(false)}
                                >
                                    <FaHome className="w-5 h-5" />
                                    Accueil
                                </Link>
                                <Link
                                    href="/all-products"
                                    className={getMobileMenuItemClassName("/all-products")}
                                    onClick={() => setIsMobileMenuOpen(false)}
                                >
                                    <FaShoppingBag className="w-5 h-5" />
                                    Boutique
                                </Link>
                                <Link
                                    href="/offer"
                                    className={getMobileMenuItemClassName("/offer")}
                                    onClick={() => setIsMobileMenuOpen(false)}
                                >
                                    <FaGift className="w-5 h-5" />
                                    Offres
                                </Link>
                                <Link
                                    href="/contact"
                                    className={getMobileMenuItemClassName("/contact")}
                                    onClick={() => setIsMobileMenuOpen(false)}
                                >
                                    <FaEnvelope className="w-5 h-5" />
                                    Contact
                                </Link>

                                {!isLoggedIn ? (
                                    <>
                                        <Link
                                            href="/register"
                                            className={getMobileMenuItemClassName("/register")}
                                            onClick={() => setIsMobileMenuOpen(false)}
                                        >
                                            <FaUserPlus className="w-5 h-5" />
                                            S&#39;inscrire
                                        </Link>
                                        <Link
                                            href="/login"
                                            className={getMobileMenuItemClassName("/login")}
                                            onClick={() => setIsMobileMenuOpen(false)}
                                        >
                                            <FaSignInAlt className="w-5 h-5" />
                                            Se connecter
                                        </Link>
                                    </>
                                ) : (
                                    <>
                                        <Link
                                            href="/cart"
                                            className={getMobileMenuItemClassName("/cart")}
                                            onClick={() => setIsMobileMenuOpen(false)}
                                        >
                                            <FaShoppingCart className="w-5 h-5" />
                                            Mon Panier
                                        </Link>
                                        <Link
                                            href="/my-orders"
                                            className={getMobileMenuItemClassName("/my-orders")}
                                            onClick={() => setIsMobileMenuOpen(false)}
                                        >
                                            <FaShoppingBag className="w-5 h-5" />
                                            Mes Commandes
                                        </Link>
                                        {isAdmin && ( // Maintenant, seul l'admin a accès au tableau de bord /seller
                                            <Link href="/seller"
                                                className={getMobileMenuItemClassName("/seller")}
                                                onClick={() => setIsMobileMenuOpen(false)}
                                            >
                                                <MdOutlineDashboard className="w-5 h-5" />
                                                Tableau de bord (Admin)
                                            </Link>
                                        )}
                                        {/* SUPPRIMEZ OU COMMENTEZ LE BLOC 'isSeller' POUR LE MOBILE */}
                                        {/* {!isAdmin && isSeller && (
                                            <Link href="/seller"
                                                className={getMobileMenuItemClassName("/seller")}
                                                onClick={() => setIsMobileMenuOpen(false)}
                                            >
                                                <MdOutlineDashboard className="w-5 h-5" />
                                                Tableau de bord (Vendeur)
                                            </Link>
                                        )} */}
                                        <button
                                            onClick={handleLogoutConfirmation}
                                            className="flex items-center gap-3 text-lg w-full py-2 px-3 rounded-md text-red-600 hover:bg-red-50 transition duration-200 ease-in-out text-left"
                                        >
                                            <FaSignOutAlt className="w-5 h-5" />
                                            Déconnexion
                                        </button>
                                    </>
                                )}
                            </>
                        )}
                    </div>
                )}
            </nav>
        </>
    );
};

export default Navbar;