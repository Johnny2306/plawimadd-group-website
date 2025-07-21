// C:\xampp\htdocs\plawimadd_group\lib\authUtils.ts

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth'; // Utilisé pour les API Routes
import { authOptions } from '@/app/api/auth/[...nextauth]/route'; // Chemin vers vos options d'authentification
import jwt from 'jsonwebtoken';
import { User } from '@/lib/types'; // Assurez-vous que l'interface User est correctement définie ici

// Déclaration de module pour étendre l'interface Request de Next.js si nécessaire
// Cela permet d'attacher l'objet 'user' à la requête après autorisation.
declare module 'next/server' {
    interface NextRequest {
        user?: User; // Ajoute la propriété 'user' optionnelle à NextRequest
    }
}

// Interface pour le contexte de la route dynamique
// Elle contient les paramètres dynamiques de l'URL.
export interface Context {
    params?: { // 'params' peut être optionnel si la route n'est pas dynamique
        userId?: string; // Pour les routes comme /api/users/[userId]
        id?: string;     // Pour les routes comme /api/products/[id] ou /api/orders/[id]
        [key: string]: string | undefined; // Permet d'autres paramètres dynamiques si nécessaire
    };
}

// Interface pour le résultat des fonctions d'autorisation.
// Indique si l'utilisateur est autorisé, une réponse si non autorisé, et les détails de l'utilisateur.
export interface AuthResult {
    authorized: boolean;
    response?: NextResponse; // Optionnel : une réponse HTTP à retourner si l'autorisation échoue
    userId?: string;         // L'ID de l'utilisateur autorisé (si autorisé)
    userRole?: 'USER' | 'ADMIN'; // Le rôle de l'utilisateur (si autorisé)
}

/**
 * Fonction d'autorisation pour les routes API nécessitant un userId spécifique dans les paramètres URL.
 * Vérifie l'authentification via NextAuth session ou via un JWT.
 * L'utilisateur doit être l'utilisateur ciblé par l'URL ou un ADMIN.
 *
 * @param req La requête NextRequest.
 * @param context Le contexte de la route, contenant les paramètres dynamiques (ex: userId/id).
 * @returns Un objet AuthResult indiquant si l'utilisateur est autorisé et les détails si oui.
 */
export async function authorizeUser(req: NextRequest, context: Context): Promise<AuthResult> {
    // CORRECTION CRUCIALE: Await context.params
    // Next.js 13+ peut renvoyer 'params' comme une Promise ou un Proxy qui doit être résolu.
    // L'erreur "params should be awaited" indique cela.
    const resolvedParams = await context.params; // Assurez-vous que context.params est un objet

    // Gère les paramètres [userId] ou [id] pour les routes dynamiques
    // Utiliser le chaînage optionnel `?.` car `resolvedParams` peut être undefined si `context.params` était undefined
    const userIdFromParams = resolvedParams?.userId || resolvedParams?.id;

    if (!userIdFromParams) {
        console.error("authorizeUser appelée sans un userId ou id valide dans context.params. Cette fonction est conçue pour les routes dynamiques.");
        return { authorized: false, response: NextResponse.json({ message: 'Configuration de route incorrecte : ID de ressource manquant dans les paramètres d\'URL.' }, { status: 500 }) };
    }

    const session = await getServerSession(authOptions);

    if (session?.user) {
        // Assurez-vous que session.user.id et session.user.role sont correctement typés dans next-auth.d.ts
        if (session.user.id === userIdFromParams || session.user.role === 'ADMIN') {
            console.log("Autorisation réussie via la session NextAuth.");
            // Attache l'utilisateur à l'objet req pour faciliter l'accès dans la route API suivante
            req.user = session.user as User; // Cast pour s'assurer du type User
            return { authorized: true, userId: session.user.id, userRole: session.user.role as 'USER' | 'ADMIN' };
        }
    }

    const authToken = req.headers.get('auth-token');

    if (authToken) {
        try {
            // Assurez-vous que JWT_SECRET est défini dans vos variables d'environnement
            const JWT_SECRET = process.env.JWT_SECRET;
            if (!JWT_SECRET) {
                console.error("ERREUR: JWT_SECRET n'est pas défini dans les variables d'environnement. Veuillez le configurer pour la sécurité.");
                return { authorized: false, response: NextResponse.json({ message: 'Erreur de configuration du serveur.' }, { status: 500 }) };
            }

            interface DecodedToken {
                id: string;
                role: 'ADMIN' | 'USER';
                [key: string]: unknown; // Permet d'autres propriétés dans le JWT
            }

            const decodedToken = jwt.verify(authToken, JWT_SECRET) as DecodedToken;
            const userIdFromToken = decodedToken.id;
            const userRoleFromToken = decodedToken.role;

            if (userIdFromToken === userIdFromParams || userRoleFromToken === 'ADMIN') {
                console.log("Autorisation réussie via auth-token.");
                // Attache l'utilisateur à l'objet req
                req.user = { id: userIdFromToken, role: userRoleFromToken } as User; // Crée un objet User minimal
                return { authorized: true, userId: userIdFromToken, userRole: userRoleFromToken };
            } else {
                console.warn(`Auth-token fourni, mais l'ID utilisateur ne correspond pas (${userIdFromToken} vs ${userIdFromParams}) et n'est pas ADMIN.`);
                return { authorized: false, response: NextResponse.json({ message: 'Jeton non autorisé pour cette ressource.' }, { status: 403 }) };
            }
        } catch (_jwtError: unknown) {
            console.error("Erreur de validation du JWT:", _jwtError);
            return { authorized: false, response: NextResponse.json({ message: 'Jeton d\'authentification invalide ou expiré.' }, { status: 401 }) };
        }
    }

    console.warn("Autorisation échouée : Aucune session valide ou auth-token trouvé.");
    return { authorized: false, response: NextResponse.json({ message: 'Non authentifié.' }, { status: 401 }) };
}

/**
 * Fonction d'autorisation spécifique pour les routes d'administration.
 * Vérifie si l'utilisateur est authentifié et a le rôle 'ADMIN'.
 * Utilise la session NextAuth en priorité, puis le JWT.
 *
 * @param req La requête NextRequest.
 * @returns Un objet AuthResult indiquant si l'utilisateur est autorisé et les détails si oui.
 */
export async function authorizeAdminRequest(req: NextRequest): Promise<AuthResult> {
    const session = await getServerSession(authOptions);

    if (session?.user) {
        if (session.user.role === 'ADMIN') {
            console.log("Accès ADMIN autorisé via la session NextAuth.");
            req.user = session.user as User; // Attache l'utilisateur à l'objet req
            return { authorized: true, userId: session.user.id, userRole: 'ADMIN' };
        } else {
            console.warn(`Accès non autorisé à une API d'administration par ${session.user.id} (Rôle: ${session.user.role || 'Aucun'})`);
            return {
                authorized: false,
                response: NextResponse.json({ message: 'Accès interdit. Seuls les administrateurs sont autorisés.' }, { status: 403 }),
            };
        }
    }

    const authToken = req.headers.get('auth-token');

    if (authToken) {
        try {
            const JWT_SECRET = process.env.JWT_SECRET;
            if (!JWT_SECRET) {
                console.error("ERREUR: JWT_SECRET n'est pas défini dans les variables d'environnement. Veuillez le configurer pour la sécurité.");
                return { authorized: false, response: NextResponse.json({ message: 'Erreur de configuration du serveur.' }, { status: 500 }) };
            }

            interface DecodedToken {
                id: string;
                role: 'ADMIN' | 'USER';
                [key: string]: unknown;
            }

            const decodedToken = jwt.verify(authToken, JWT_SECRET) as DecodedToken;
            if (decodedToken.role === 'ADMIN') {
                console.log("Accès ADMIN autorisé via auth-token.");
                req.user = { id: decodedToken.id, role: decodedToken.role } as User; // Attache l'utilisateur à l'objet req
                return { authorized: true, userId: decodedToken.id, userRole: 'ADMIN' };
            } else {
                console.warn(`Auth-token fourni, mais le rôle de l'utilisateur n'est pas ADMIN.`);
                return { authorized: false, response: NextResponse.json({ message: 'Accès interdit. Seuls les administrateurs sont autorisés.' }, { status: 403 }) };
            }
        } catch (_jwtError: unknown) {
            console.error("Erreur de validation du JWT pour l'admin:", _jwtError);
            return { authorized: false, response: NextResponse.json({ message: 'Jeton d\'authentification invalide ou expiré.' }, { status: 401 }) };
        }
    }

    console.warn("Accès non authentifié à une API d'administration: Aucune session ou token valide.");
    return { authorized: false, response: NextResponse.json({ message: 'Non authentifié.' }, { status: 401 }) };
}


/**
 * Fonction d'autorisation pour les routes nécessitant simplement qu'un utilisateur soit connecté (authentifié).
 * Récupère l'ID de l'utilisateur connecté via la session NextAuth ou un JWT.
 * N'utilise PAS de `userId` des paramètres d'URL.
 *
 * @param req La requête NextRequest.
 * @returns Un objet AuthResult indiquant si l'utilisateur est authentifié et son ID.
 */
export async function authorizeLoggedInUser(req: NextRequest): Promise<AuthResult> {
    const session = await getServerSession(authOptions);

    if (session?.user?.id) {
        console.log("Autorisation réussie via la session NextAuth pour l'utilisateur connecté.");
        req.user = session.user as User; // Attache l'utilisateur à l'objet req
        return { authorized: true, userId: session.user.id, userRole: session.user.role === 'ADMIN' ? 'ADMIN' : 'USER' };
    }

    const authToken = req.headers.get('auth-token');

    if (authToken) {
        try {
            const JWT_SECRET = process.env.JWT_SECRET;
            if (!JWT_SECRET) {
                console.error("ERREUR: JWT_SECRET n'est pas défini dans les variables d'environnement. Veuillez le configurer pour la sécurité.");
                return { authorized: false, response: NextResponse.json({ message: 'Erreur de configuration du serveur.' }, { status: 500 }) };
            }

            interface DecodedToken {
                id: string;
                role: 'ADMIN' | 'USER';
                [key: string]: unknown;
            }
            const decodedToken = jwt.verify(authToken, JWT_SECRET) as DecodedToken;
            console.log("Autorisation réussie via auth-token pour l'utilisateur connecté.");
            req.user = { id: decodedToken.id, role: decodedToken.role } as User; // Attache l'utilisateur à l'objet req
            return { authorized: true, userId: decodedToken.id, userRole: decodedToken.role };
        } catch (_jwtError: unknown) {
            console.error("Erreur de validation du JWT pour l'utilisateur connecté:", _jwtError);
            return { authorized: false, response: NextResponse.json({ message: 'Jeton d\'authentification invalide ou expiré.' }, { status: 401 }) };
        }
    }

    console.warn("Accès non authentifié: Aucun utilisateur connecté détecté.");
    return { authorized: false, response: NextResponse.json({ message: 'Non authentifié. Veuillez vous connecter.' }, { status: 401 }) };
}