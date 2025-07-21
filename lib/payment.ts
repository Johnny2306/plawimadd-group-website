/**
 * Vérifie la validité d'un token de paiement auprès du fournisseur.
 * Dans une vraie app, tu utiliserais ici une requête API vers le service de paiement.
 * @param token Le token reçu depuis le frontend
 * @returns true si le paiement est valide, false sinon
 */
export async function verifyPaymentToken(token: string): Promise<boolean> {
  try {
    // 🔒 Exemple fictif — à remplacer avec une vraie vérification (ex: appel à une API REST)
    // Simule que tous les tokens qui commencent par "valid_" sont acceptés
    if (!token || typeof token !== 'string') return false;

    if (token.startsWith('valid_')) {
      return true;
    }

    return false;
  } catch (error) {
    console.error("Erreur lors de la vérification du token de paiement:", error);
    return false;
  }
}
