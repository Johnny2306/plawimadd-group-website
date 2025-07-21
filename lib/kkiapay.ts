// C:\xampp\htdocs\plawimadd_group\lib\kkiapay.ts

import axios from 'axios';

// Définissez une interface pour le résultat de la vérification de Kkiapay
// C'est la structure que vous attendez de la réponse de l'API de Kkiapay
// et qui sera retournée par verifyKkiapayTransaction.
// Assurez-vous que les types correspondent à ce que Kkiapay renvoie réellement.
interface KkiapayVerificationResponse {
    status: string; // Ex: "SUCCESS", "PENDING", "FAILED"
    amount: number;
    transactionId: string; // L'ID de transaction de Kkiapay
    paymentMethod?: string;
    reason?: string; // Raison de l'échec si le statut est FAILED
    message?: string; // Message d'erreur général
    data?: string; // Le payload JSON stringifié que vous avez envoyé
    currency?: string; // Ex: "XOF" ou "FCFA"
    // Ajoutez d'autres champs pertinents que l'API de Kkiapay pourrait renvoyer
}

/**
 * Vérifie l'état d'une transaction Kkiapay en interrogeant l'API Kkiapay (backend).
 * Cette fonction DOIT être appelée côté serveur.
 *
 * @param transactionId L'ID de transaction Kkiapay à vérifier.
 * @returns Un objet contenant le statut et d'autres informations de la transaction.
 * @throws Error si la clé API privée est manquante ou si la requête API échoue.
 */
export async function verifyKkiapayTransaction(transactionId: string): Promise<KkiapayVerificationResponse> {
    console.log(`[Kkiapay Verify] Tentative de vérification de la transaction: ${transactionId}`);

    const KKIAPAY_PRIVATE_API_KEY = process.env.KKIAPAY_PRIVATE_API_KEY; // Votre clé secrète

    if (!KKIAPAY_PRIVATE_API_KEY) {
        console.error("[Kkiapay Verify] ERREUR: KKIAPAY_PRIVATE_API_KEY n'est pas définie dans les variables d'environnement.");
        throw new Error('La clé API privée Kkiapay est manquante. Contactez l\'administrateur.');
    }
    console.log("[Kkiapay Verify] KKIAPAY_PRIVATE_API_KEY est définie (non vide)."); // Log pour confirmer sa présence

    // Déterminez l'URL de l'API de vérification Kkiapay
    // Utilisez l'URL sandbox en développement et l'URL de production en production.
    const KKIAPAY_API_BASE_URL = process.env.NODE_ENV === 'production'
        ? 'https://api.kkiapay.me'
        : 'https://api-sandbox.kkiapay.me'; // L'URL de l'API Sandbox de Kkiapay

    const verifyUrl = `${KKIAPAY_API_BASE_URL}/v1/transactions/verify`;
    console.log(`[Kkiapay Verify] URL de vérification utilisée: ${verifyUrl}`); // Log l'URL utilisée

    try {
        const response = await axios.post<KkiapayVerificationResponse>(
            verifyUrl,
            { transactionId: transactionId },
            {
                headers: {
                    'X-API-KEY': KKIAPAY_PRIVATE_API_KEY,
                    'Content-Type': 'application/json'
                }
            }
        );

        console.log(`[Kkiapay Verify] Réponse de l'API Kkiapay pour ${transactionId}:`, response.data);

        // Kkiapay renvoie généralement un objet avec des informations sur la transaction.
        // Ici, nous nous attendons à 'status', 'amount', 'transactionId', etc.
        if (!response.data || !response.data.status) {
            console.error(`[Kkiapay Verify] Réponse API Kkiapay inattendue pour ${transactionId}:`, response.data);
            throw new Error('Réponse de l\'API Kkiapay invalide.');
        }

        return response.data;

    } catch (error) {
        if (axios.isAxiosError(error)) {
            console.error(`[Kkiapay Verify] Erreur Axios lors de la vérification de ${transactionId}:`);
            console.error(`  Statut HTTP: ${error.response?.status}`); // Log le statut HTTP
            console.error(`  Données de réponse:`, error.response?.data); // Log les données de réponse complètes
            console.error(`  Message d'erreur Axios: ${error.message}`);

            // Kkiapay peut renvoyer des messages d'erreur spécifiques dans error.response.data
            const kkiapayErrorMessage = error.response?.data?.message || error.message;
            throw new Error(`Échec de la vérification Kkiapay: ${kkiapayErrorMessage}`);
        } else {
            console.error(`[Kkiapay Verify] Erreur inattendue lors de la vérification de ${transactionId}:`, error);
            throw new Error('Erreur serveur interne lors de la vérification Kkiapay.');
        }
    }
}
