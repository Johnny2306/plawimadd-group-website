// C:\xampp\htdocs\plawimadd_group\app\api\order\prepare-payment\route.ts
// Cette route génère un ID de transaction unique pour une transaction Kkiapay,
// après avoir vérifié que l'utilisateur est authentifié.

import { NextResponse, NextRequest } from 'next/server'; // Ajout de NextRequest pour le type, bien que non utilisé directement pour GET
import { v4 as uuidv4 } from 'uuid'; // Pour la génération d'UUID
import { authorizeLoggedInUser, AuthResult } from '@/lib/authUtils'; // Importez la fonction d'autorisation utilisateur

export async function GET(req: NextRequest): Promise<NextResponse> {
    // 1. Authentification de l'utilisateur
    const authResult: AuthResult = await authorizeLoggedInUser(req);
    if (!authResult.authorized) {
        return authResult.response!; // Renvoie la réponse d'erreur fournie par authorizeLoggedInUser
    }
    // L'ID de l'utilisateur authentifié est disponible via authResult.userId si nécessaire, mais pas pour cette route spécifique.

    try {
        // 2. Génération de l'ID de transaction unique
        const transactionId = uuidv4();
        console.log(`Génération d'un transactionId pour Kkiapay: ${transactionId}`);

        return NextResponse.json(
            {
                success: true,
                message: 'Transaction ID généré avec succès pour Kkiapay.',
                transactionId,
            },
            { status: 200 }
        );
    } catch (_error: unknown) { // CORRECTION: Renommé 'error' en '_error'
        console.error('Erreur lors de la génération du transactionId:', _error);
        const errorMessage = _error instanceof Error ? _error.message : String(_error);
        return NextResponse.json(
            {
                success: false,
                message: `Erreur serveur lors de la préparation du paiement: ${errorMessage}`,
            },
            { status: 500 }
        );
    }
}