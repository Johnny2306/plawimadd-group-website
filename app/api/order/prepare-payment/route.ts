// app/api/order/prepare-payment/route.ts
// Gère la génération d'un ID de transaction unique pour la commande.

import { NextResponse, NextRequest } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { authorizeLoggedInUser, AuthResult } from '@/lib/authUtils'; // Assurez-vous que cette fonction est correcte

export async function GET(req: NextRequest): Promise<NextResponse> {
  // Autoriser uniquement les utilisateurs connectés
  const authResult: AuthResult = await authorizeLoggedInUser(req);
  if (!authResult.authorized) {
    return authResult.response!;
  }

  try {
    // Générer un ID de transaction unique pour votre système de commande.
    // Cet ID sera utilisé pour lier votre commande interne à la transaction Kkiapay.
    const transactionId = uuidv4();

    // NOTE IMPORTANTE:
    // Le bloc de code commenté ci-dessous est destiné à l'initiation de paiement
    // CÔTÉ SERVEUR (server-to-server) avec Kkiapay.
    // Votre implémentation actuelle utilise le widget Kkiapay CÔTÉ CLIENT
    // (via le script dans app/layout.tsx et window.Kkiapay.open()).
    // Pour cette approche, cette route API doit SEULEMENT générer un ID de transaction unique
    // que le frontend utilisera ensuite avec le widget Kkiapay.
    // Ne décommentez ce bloc que si vous passez à une initiation de paiement entièrement côté serveur.
    /*
    const KKIAPAY_PRIVATE_API_KEY_LIVE = process.env.KKIAPAY_PRIVATE_API_KEY; // Utiliser la clé privée LIVE
    const KKIAPAY_API_BASE_URL_LIVE = 'https://api.kkiapay.me'; // Endpoint LIVE

    if (!KKIAPAY_PRIVATE_API_KEY_LIVE) {
        console.error("KKIAPAY_PRIVATE_API_KEY n'est pas définie. Impossible d'initier le paiement côté serveur.");
        throw new Error("Clé API privée Kkiapay manquante.");
    }

    const initiationEndpoint = `${KKIAPAY_API_BASE_URL_LIVE}/v1/transactions/initiate`; // Vérifier l'endpoint exact de Kkiapay pour l'initiation

    const response = await axios.post(
        initiationEndpoint,
        {
            // Ces valeurs (montant, téléphone, email, etc.) devraient venir de la commande réelle,
            // et non être codées en dur.
            amount: 15300, // Exemple de montant, à remplacer par le montant réel de la commande
            currency: 'XOF',
            phone: '22997000000', // Exemple, à remplacer par le numéro de téléphone de l'utilisateur
            email: 'user@example.com', // Exemple, à remplacer par l'email de l'utilisateur
            reason: 'Achat de produits Plawimadd Group',
            // Vous pouvez aussi passer 'transactionId' ici si Kkiapay l'attend pour l'initiation
            // et qu'il sera renvoyé dans le callback.
            // transactionId: transactionId,
        },
        {
            headers: {
                'X-API-KEY': KKIAPAY_PRIVATE_API_KEY_LIVE, // Utiliser X-API-KEY pour la clé privée
                'Content-Type': 'application/json',
            },
        }
    );
    console.log("Réponse d'initiation Kkiapay (si décommenté):", response.data);
    */

    console.log(`Transaction ID généré par le backend: ${transactionId}`);

    return NextResponse.json(
      {
        success: true,
        message: 'Transaction ID généré avec succès pour le paiement Kkiapay.',
        transactionId,
        // kkiapayResponse: response.data // Décommenter si le bloc d'initiation est actif
      },
      { status: 200 }
    );
  } catch (_error: unknown) {
    console.error('Erreur lors de la génération du Transaction ID ou de l\'appel Kkiapay (si décommenté) :', _error);
    const errorMessage = _error instanceof Error ? _error.message : String(_error);
    return NextResponse.json(
      {
        success: false,
        message: `Erreur lors de la préparation du paiement : ${errorMessage}`,
      },
      { status: 500 }
    );
  }
}
