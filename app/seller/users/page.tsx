// app/seller/users/page.tsx
'use client';

import React, { useEffect, useState, useCallback } from "react";
import Loading from "@/components/Loading";
import Footer from "@/components/seller/Footer";
import axios from "axios";
import { useSession } from 'next-auth/react';
import { Users, CalendarDays, Mail, UserRound } from 'lucide-react';
import { useAppContext } from "@/context/AppContext";

// Interface pour la structure des données utilisateur
interface User {
    id: string;
    name?: string; // Optionnel, car il peut être construit à partir de firstName/lastName
    firstName?: string;
    lastName?: string;
    email: string;
    createdAt: string; // Ou Date si vous le convertissez en objet Date plus tôt
    role?: string; // Ajouté si les utilisateurs peuvent avoir des rôles
}

/**
 * Composant de la page de gestion des utilisateurs pour les administrateurs.
 * Affiche une liste des utilisateurs enregistrés et gère les autorisations d'accès.
 * @returns {React.ReactElement} Le JSX de la page de gestion des utilisateurs.
 */
const UserManagement = (): React.ReactElement => {
    // Utilisation du contexte global, assurez-vous que AppContext fournit les types corrects
    const { url } = useAppContext();
    const { data: session, status } = useSession(); // 'status' est le statut de la session NextAuth

    // États du composant avec typage explicite
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    /**
     * Récupère tous les utilisateurs depuis l'API.
     * Utilise `useCallback` pour éviter des recréations inutiles de la fonction.
     */
    const fetchAllUsers = useCallback(async (): Promise<void> => {
        if (status === 'loading') {
            // Si la session est encore en cours de chargement, ne rien faire et attendre
            return;
        }

        // Vérifie l'authentification et le rôle de l'utilisateur
        if (status !== 'authenticated' || session?.user?.role?.toLowerCase() !== 'admin') {
            setLoading(false);
            setError("Accès non autorisé. Vous devez être connecté en tant qu'administrateur.");
            return;
        }

        setLoading(true); // Mettre à jour l'état de chargement au début du fetch
        setError(null); // Réinitialiser l'erreur

        try {
            // Type la réponse d'Axios pour un tableau d'utilisateurs
            const response = await axios.get<User[]>(`${url}/api/admin/users?role=user`);
            if (response.status === 200 && Array.isArray(response.data)) {
                setUsers(response.data);
            } else {
                setError("Format de données inattendu ou API indisponible.");
            }
        } catch (err: unknown) { // Type l'erreur comme 'unknown'
            console.error('Erreur lors du chargement des utilisateurs:', err);
            if (axios.isAxiosError(err) && err.response) { // Vérifie si c'est une erreur Axios
                if (err.response.status === 403) {
                    setError("Accès interdit. Permissions insuffisantes.");
                } else {
                    setError(`Erreur serveur : ${err.response.data?.message || 'Chargement impossible.'}`);
                }
            } else {
                setError("Erreur réseau ou inattendue.");
            }
        } finally {
            setLoading(false);
        }
    }, [url, status, session]); // Dépendances de useCallback

    // Effet pour charger les utilisateurs lors du changement de statut de session ou de la fonction fetchAllUsers
    useEffect(() => {
        fetchAllUsers();
    }, [fetchAllUsers]);

    /**
     * Formate un timestamp en date et heure complètes.
     * @param {string | number | Date | null | undefined} timestamp Le timestamp à formater.
     * @returns {string} La date et l'heure formatées ou "N/A".
     */
    const formatFullDateTime = (timestamp: string | number | Date | null | undefined): string => {
        if (!timestamp) return "N/A";
        const date = new Date(timestamp);
        // Vérifie si la date est valide
        if (isNaN(date.getTime())) return "Date invalide";
        return date.toLocaleString('fr-FR', {
            year: 'numeric', month: 'short', day: 'numeric',
            hour: '2-digit', minute: '2-digit',
            hour12: false
        });
    };

    return (
        <div className="flex flex-col min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-indigo-100 font-inter">
            <main className="flex-1 p-4 md:p-8 lg:p-10 w-full max-w-7xl mx-auto">
                <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
                    <div className="flex items-center gap-4">
                        <Users className="w-10 h-10 text-blue-600" aria-hidden='true' /> {/* Icône décorative */}
                        <h1 className="text-4xl font-extrabold text-gray-900 leading-tight">Gestion des Utilisateurs</h1>
                    </div>
                    <div className="bg-blue-100 text-blue-800 px-4 py-2 rounded-full text-sm font-semibold shadow-md" aria-live="polite">
                        Total : {users.length} client{users.length > 1 && 's'}
                    </div>
                </div>

                {loading ? (
                    <div className="flex justify-center items-center h-64 bg-white rounded-xl shadow-lg" role='status'>
                        <Loading />
                    </div>
                ) : error ? (
                    <div className="text-center bg-red-100 border border-red-300 text-red-800 p-6 rounded-xl shadow-md" role='alert'>
                        <h2 className="text-xl font-bold mb-3">Erreur de Chargement</h2>
                        <p className="mb-4">{error}</p>
                        <button
                            onClick={() => error?.includes("connecté") ? window.location.href = '/login' : fetchAllUsers()}
                            className="px-6 py-3 bg-blue-600 text-white rounded-lg shadow-md hover:bg-blue-700 transition-transform duration-200 hover:scale-105"
                            aria-label={error?.includes("connecté") ? 'Se connecter' : 'Réessayer de charger les utilisateurs'}
                        >
                            {error?.includes("connecté") ? 'Se connecter' : 'Réessayer'}
                        </button>
                    </div>
                ) : (
                    <div className="bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden">
                        <div className="p-5 md:p-6 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
                            <h2 className="text-2xl font-semibold text-gray-800 flex items-center gap-2">
                                <UserRound className="w-6 h-6 text-gray-600" aria-hidden='true' /> Utilisateurs Enregistrés
                            </h2>
                            <span className="text-sm text-gray-500" aria-live="polite">Dernière mise à jour : {new Date().toLocaleDateString('fr-FR')}</span>
                        </div>
                        {users.length === 0 ? (
                            <p className="text-gray-600 text-center p-10 text-lg" role='status'>
                                <span className="block mb-2" aria-hidden='true'>😔</span> Aucun utilisateur trouvé.
                            </p>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-gray-200 text-sm">
                                    <thead className="bg-gray-100 text-gray-600 uppercase text-xs tracking-wider">
                                        <tr>
                                            <th scope="col" className="py-4 px-6 text-left">Nom</th>
                                            <th scope="col" className="py-4 px-6 text-left">Email</th>
                                            <th scope="col" className="py-4 px-6 text-left">Date d&#39;inscription</th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {users.map((user: User) => ( // Type user comme User
                                            <tr key={user.id} className="hover:bg-blue-50 transition-colors">
                                                <td className="py-4 px-6 font-medium text-gray-900">
                                                    {user.name || `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'N/A'}
                                                </td>
                                                <td className="py-4 px-6 text-gray-700">
                                                    <Mail className="inline-block w-4 h-4 mr-1 text-gray-500" aria-hidden='true' />
                                                    {user.email || 'N/A'}
                                                </td>
                                                <td className="py-4 px-6 whitespace-nowrap text-gray-600">
                                                    <CalendarDays className="inline-block w-4 h-4 mr-1 text-gray-500" aria-hidden='true' />
                                                    {formatFullDateTime(user.createdAt)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}
            </main>
            <Footer />
        </div>
    );
};

export default UserManagement;
