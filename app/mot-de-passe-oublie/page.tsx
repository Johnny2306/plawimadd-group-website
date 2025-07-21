// app/mot-de-passe-oublie/page.tsx
'use client';

import React, { useState, FormEvent, ChangeEvent } from 'react';
import Link from 'next/link';
import { FiMail, FiArrowRight, FiCheckCircle, FiAlertCircle } from 'react-icons/fi';

/**
 * Composant de la page "Mot de passe oublié".
 * Permet à l'utilisateur de demander un lien de réinitialisation de mot de passe par email.
 * Gère les états de chargement, de message et d'erreur.
 * @returns {React.ReactElement} Le JSX de la page de mot de passe oublié.
 */
export default function ForgotPasswordPage(): React.ReactElement {
    const [email, setEmail] = useState<string>('');
    const [message, setMessage] = useState<string>('');
    const [error, setError] = useState<string>('');
    const [isLoading, setIsLoading] = useState<boolean>(false);

    const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setMessage('');
        setError('');
        setIsLoading(true);

        try {
            const response = await fetch('/api/users/mot-de-passe-oublie', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email }),
            });

            // Gérer les réponses non-OK de manière plus spécifique
            if (!response.ok) {
                const errorData = await response.json();
                // Utilisez errorData.message si disponible, sinon un message par défaut basé sur le statut
                setError(errorData.message || `Erreur serveur: ${response.status} ${response.statusText}`);
                return; // Important pour arrêter l'exécution si la réponse n'est pas OK
            }

            const data = await response.json();
            setMessage(data.message || 'Si cette adresse email existe, un lien de réinitialisation a été envoyé.'); // Message plus générique pour des raisons de sécurité
        } catch (err: unknown) {
            console.error('Erreur réseau ou inattendue:', err);
            // Meilleure gestion du type d'erreur pour TypeScript
            if (err instanceof Error) {
                setError(`Erreur de connexion au serveur : ${err.message}`);
            } else {
                setError('Une erreur inconnue est survenue lors de la tentative de connexion au serveur.');
            }
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-200 flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden">
                <div className="p-8">
                    <div className="text-center mb-8">
                        <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-blue-100 mb-4">
                            <FiMail className="h-6 w-6 text-blue-600" />
                        </div>
                        <h2 className="text-2xl font-bold text-gray-800">Mot de passe oublié ?</h2>
                        <p className="text-gray-500 mt-2">
                            Entrez votre adresse email pour recevoir un lien de réinitialisation de mot de passe.
                        </p>
                    </div>

                    {message && (
                        <div className="mb-6 p-3 rounded-lg bg-green-50 border border-green-200 flex items-start" role="alert" aria-live="polite"> {/* Ajout de aria-live */}
                            <FiCheckCircle className="text-green-500 mt-0.5 mr-2 flex-shrink-0" />
                            <span className="text-green-700">{message}</span>
                        </div>
                    )}
                    {error && (
                        <div className="mb-6 p-3 rounded-lg bg-red-50 border border-red-200 flex items-start" role="alert" aria-live="assertive"> {/* Ajout de aria-live */}
                            <FiAlertCircle className="text-red-500 mt-0.5 mr-2 flex-shrink-0" />
                            <span className="text-red-700">{error}</span>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div>
                            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                                Adresse email
                            </label>
                            <div className="relative rounded-md shadow-sm">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <FiMail className="h-5 w-5 text-gray-400" />
                                </div>
                                <input
                                    type="email"
                                    id="email"
                                    className="focus:ring-blue-500 focus:border-blue-500 block w-full pl-10 pr-3 py-3 border-gray-300 rounded-md"
                                    value={email}
                                    onChange={(e: ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
                                    required
                                    placeholder="email@example.com"
                                    aria-label="Adresse email"
                                    autoComplete="email" // Ajouté pour l'autocomplétion
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={isLoading}
                            className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-200"
                            aria-label="Envoyer le lien de réinitialisation"
                        >
                            <span className="absolute left-0 inset-y-0 flex items-center pl-3">
                                {isLoading ? (
                                    <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white"></div>
                                ) : (
                                    <FiArrowRight className="h-5 w-5 text-blue-300 group-hover:text-blue-200" />
                                )}
                            </span>
                            {isLoading ? 'Envoi...' : 'Envoyer le lien de réinitialisation'}
                        </button>
                    </form>

                    <p className="mt-6 text-center text-sm">
                        <Link href="/login" className="font-medium text-blue-600 hover:text-blue-500">
                            Retour à la connexion
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    );
}