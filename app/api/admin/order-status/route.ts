// app/api/admin/orders/status/route.ts
// Cette route gère la mise à jour du statut des commandes par les administrateurs.

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import pool from '@/lib/db'; // Assurez-vous que votre pool de connexion à la base de données est correctement importé
import type { PoolConnection, ResultSetHeader } from 'mysql2/promise';

interface OrderStatusPayload {
  orderId: string; // CORRECTION : L'ID de commande est une chaîne (UUID), pas un nombre.
  status: string;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  // Authentification et Autorisation (spécifique aux admins pour cette route)
  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    return NextResponse.json({ message: 'Non authentifié.' }, { status: 401 });
  }

  // Vérification du rôle administrateur
  if (session.user.role?.toUpperCase() !== 'ADMIN') {
    return NextResponse.json({ message: 'Accès interdit. Seuls les administrateurs peuvent modifier le statut des commandes.' }, { status: 403 });
  }

  let connection: PoolConnection | undefined;

  try {
    const body: OrderStatusPayload = await request.json();
    const { orderId, status } = body;

    // Validation des entrées
    if (!orderId || typeof orderId !== 'string' || !status || typeof status !== 'string') {
      return NextResponse.json({ success: false, message: 'ID de commande (chaîne) et statut (chaîne) valides sont requis.' }, { status: 400 });
    }

    connection = await pool.getConnection();

    // Exécution de la requête de mise à jour
    const [result] = await connection.execute<ResultSetHeader>(
      `UPDATE \`orders\` SET status = ? WHERE id = ?`,
      [status, orderId] // orderId est maintenant garanti comme une chaîne
    );

    if (result.affectedRows === 0) {
      return NextResponse.json({ success: false, message: 'Commande non trouvée ou statut inchangé.' }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: 'Statut de la commande mis à jour avec succès.' }, { status: 200 });

  } catch (error: unknown) {
    // Gestion des erreurs
    const message = error instanceof Error ? error.message : String(error);
    console.error("Erreur lors de la mise à jour du statut de la commande:", error); // Afficher l'erreur complète pour le débogage
    return NextResponse.json({ success: false, message: 'Erreur serveur lors de la mise à jour du statut de la commande.', error: message }, { status: 500 });
  } finally {
    // S'assurer que la connexion est toujours relâchée
    if (connection) connection.release();
  }
}