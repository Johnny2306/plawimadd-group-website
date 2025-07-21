// components/saller/SideBar.tsx
'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BarChart2, Box, ShoppingCart, Users, Package2, LucideIcon } from 'lucide-react'; // Importez LucideIcon

// --- Interfaces ---

// 1. Interface pour un élément du menu
interface MenuItem {
    name: string;
    path: string;
    icon: LucideIcon; // Le type d'une icône Lucide React est LucideIcon
}

// --- Menu Items ---
const menuItems: MenuItem[] = [ // Utilisation de l'interface MenuItem pour typer le tableau
    { name: 'Rapport', path: '/seller', icon: BarChart2 },
    { name: 'Clients', path: '/seller/users', icon: Users },
    { name: 'Stocks', path: '/seller/stocks', icon: Package2 },
    { name: 'Gérer Produits', path: '/seller/product-list', icon: Box },
    { name: 'Gérer Commandes', path: '/seller/orders', icon: ShoppingCart },
];

// --- SideBar Component ---
const SideBar = () => {
    const pathname = usePathname();
    const [currentDateTime, setCurrentDateTime] = useState<string>(''); // Typez l'état comme string

    // Effet pour afficher la date et l'heure de Porto-Novo
    useEffect(() => {
        const updateDateTime = () => {
            const now = new Date();
            const options: Intl.DateTimeFormatOptions = { // Typez les options pour toLocaleString
                timeZone: 'Africa/Porto-Novo',
                weekday: 'short', // ex: lun.
                year: 'numeric',
                month: 'numeric',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: false // Format 24 heures
            };
            setCurrentDateTime(now.toLocaleString('fr-FR', options));
        };

        // Met à jour immédiatement et ensuite toutes les secondes
        updateDateTime();
        const intervalId = setInterval(updateDateTime, 1000);

        // Nettoyage de l'intervalle lors du démontage du composant
        return () => clearInterval(intervalId);
    }, []);

    return (
        <aside className="bg-white border-r min-h-screen py-6 px-3 md:w-64 w-20 shadow-sm flex flex-col justify-between">
            <div>
                <h2 className="text-center text-lg font-semibold text-blue-600 mb-6 hidden md:block">
                    Tableau de bord
                </h2>

                <nav className="flex flex-col gap-3">
                    {menuItems.map(({ name, path, icon: Icon }: MenuItem) => { // Déstructurez et typez l'élément de menu
                        const isActive = pathname === path;

                        return (
                            <Link href={path} key={name} passHref>
                                <div
                                    className={`flex items-center gap-4 px-4 py-3 rounded-lg cursor-pointer transition-colors
                                        ${isActive
                                            ? 'bg-blue-100 text-blue-700 font-semibold'
                                            : 'hover:bg-gray-100 text-gray-700'}
                                    `}
                                >
                                    <Icon className="w-5 h-5" />
                                    <span className="hidden md:inline text-sm">{name}</span>
                                </div>
                            </Link>
                        );
                    })}
                </nav>
            </div>

            <div className="mt-auto text-center text-gray-600 text-xs md:text-sm p-2 border-t border-gray-200 md:block hidden">
                {currentDateTime}
            </div>
        </aside>
    );
};

export default SideBar;