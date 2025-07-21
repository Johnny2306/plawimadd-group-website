// app/api/admin/orders/[orderId]/route.ts
// Cette route gère la suppression d'une commande spécifique par les administrateurs.

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import prisma from '@/lib/prisma'; // Importez votre client Prisma

interface Context {
    params: {
        orderId: string; // L'ID de commande est une chaîne (UUID)
    };
}

export async function DELETE(request: NextRequest, context: Context): Promise<NextResponse> {
    // Authentification et Autorisation (spécifique aux admins pour cette route)
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
        console.warn("Accès non authentifié à l'API DELETE /api/admin/orders/[orderId].");
        return NextResponse.json({ message: 'Non authentifié.' }, { status: 401 });
    }

    if (session.user.role?.toUpperCase() !== 'ADMIN') {
        console.warn(`Accès non autorisé à DELETE /api/admin/orders/[orderId] par ${session.user.id} (Rôle: ${session.user.role || 'Aucun'})`);
        return NextResponse.json({ message: 'Accès interdit. Seuls les administrateurs peuvent supprimer des commandes.' }, { status: 403 });
    }

    const orderId = context.params.orderId;

    if (!orderId || typeof orderId !== 'string') {
        return NextResponse.json({ success: false, message: 'ID de commande valide (chaîne) manquant.' }, { status: 400 });
    }

    try {
        // Utilisation de la transaction Prisma pour garantir l'atomicité des opérations
        const [deleteOrderItemsResult, deletePaymentsResult, deleteOrderResult] = await prisma.$transaction([
            // 1. Supprimer les OrderItems associés à la commande
            prisma.orderItem.deleteMany({
                where: { orderId: orderId },
            }),
            // 2. Supprimer les Payments associés à la commande
            prisma.payment.deleteMany({
                where: { orderId: orderId },
            }),
            // 3. Supprimer la commande elle-même
            prisma.order.deleteMany({ // Utiliser deleteMany car delete unique nécessite un champ unique comme ID
                where: { id: orderId },
            }),
        ]);

        // Vérifier si la commande principale a été supprimée
        if (deleteOrderResult.count === 0) {
            // Si la commande n'a pas été trouvée, la transaction sera annulée par Prisma si les autres opérations ont échoué.
            // Mais si elle n'a jamais existé, count sera 0.
            return NextResponse.json({ success: false, message: 'Commande non trouvée ou déjà supprimée.' }, { status: 404 });
        }

        console.log(`Commande ${orderId} supprimée. Articles supprimés: ${deleteOrderItemsResult.count}, Paiements supprimés: ${deletePaymentsResult.count}`);

        return NextResponse.json({
            success: true,
            message: 'Commande et ses éléments associés supprimés avec succès.'
        }, { status: 200 });

    } catch (_error: unknown) { // Correction ESLint: renommé 'error' en '_error'
        // Prisma gère automatiquement le rollback en cas d'erreur dans une transaction.
        const message = _error instanceof Error ? _error.message : String(_error);
        console.error("Erreur CRITIQUE dans DELETE /api/admin/orders/[orderId]:", _error); // Afficher l'erreur complète pour le débogage
        return NextResponse.json({
            success: false,
            message: 'Erreur serveur lors de la suppression de la commande.',
            error: message
        }, { status: 500 });

    }
    // Pas de bloc finally pour connection.release() car nous utilisons Prisma, qui gère ses propres connexions.
}