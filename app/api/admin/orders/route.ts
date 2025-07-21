// C:\xampp\htdocs\plawimadd_group\app\api\admin\orders\route.ts
// Cette route gère la récupération de toutes les commandes pour le tableau de bord administrateur.

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import prisma from '@/lib/prisma'; // Importez votre client Prisma
// Plus besoin de pool, PoolConnection, RowDataPacket de mysql2/promise

export async function GET(): Promise<NextResponse> {
    // 1. Authentification et Autorisation
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
        console.warn("Accès non authentifié à l'API /api/admin/orders.");
        return NextResponse.json({ message: 'Non authentifié.' }, { status: 401 });
    }

    if (session.user.role?.toUpperCase() !== 'ADMIN') {
        console.warn(`Accès non autorisé à l'API /api/admin/orders par ${session.user.id} (Rôle: ${session.user.role || 'Aucun'})`);
        return NextResponse.json({ message: 'Accès interdit. Seuls les administrateurs peuvent voir cette page.' }, { status: 403 });
    }

    try {
        // 2. Récupération des commandes avec toutes les relations nécessaires via Prisma
        // Cela résout le problème de N+1 queries en une seule requête optimisée.
        const orders = await prisma.order.findMany({
            orderBy: { orderDate: 'desc' }, // Trie par date de commande, la plus récente en premier
            include: {
                user: { // Inclut les informations de l'utilisateur qui a passé la commande
                    select: {
                        firstName: true,
                        lastName: true,
                        email: true,
                        phoneNumber: true,
                    },
                },
                payment: { // Inclut les informations de paiement liées (si elles existent)
                    select: {
                        paymentMethod: true,
                        status: true, // Ceci est le PaymentStatus de la table Payment
                        transactionId: true,
                        paymentDate: true,
                    },
                },
                orderItems: { // Inclut tous les articles de chaque commande
                    include: {
                        product: { // Inclut les détails du produit pour chaque article de commande
                            select: {
                                name: true,
                                imgUrl: true,
                                price: true, // Prix du produit actuel (pour référence, priceAtOrder est le prix au moment de la commande)
                            },
                        },
                    },
                },
                // Vous pouvez inclure d'autres relations si nécessaire, par exemple shippingAddress si vous en avez besoin séparément
                // shippingAddress: true,
            },
        });

        // 3. Formater les données pour la réponse frontend
        // Nous devons mapper les objets Prisma pour qu'ils correspondent au format attendu par votre frontend,
        // notamment pour les champs calculés (userName) et la gestion de imgUrl.
        const formattedOrders = orders.map(order => {
            // Construire le nom complet de l'utilisateur
            const userName = `${order.user?.firstName || ''} ${order.user?.lastName || ''}`.trim();

            // Mapper les articles de commande pour inclure les détails du produit
            const items = order.orderItems.map(item => {
                let imgArray: string[] = [];
                // La logique de parsing de imgUrl est conservée ici car votre schéma Product.imgUrl est Text
                // et votre code précédent suggère qu'il peut contenir une chaîne JSON d'URLs.
                if (item.product?.imgUrl) {
                    try {
                        const parsed = JSON.parse(item.product.imgUrl);
                        if (Array.isArray(parsed)) {
                            imgArray = parsed;
                        } else if (typeof parsed === 'string') {
                            imgArray = [parsed];
                        }
                    } catch {
                        // Si le parsing échoue, et c'est une chaîne, utilisez-la directement
                        if (typeof item.product.imgUrl === 'string' && (item.product.imgUrl.startsWith('/') || item.product.imgUrl.startsWith('http'))) {
                            imgArray = [item.product.imgUrl];
                        }
                    }
                }

                return {
                    productId: item.productId,
                    quantity: item.quantity,
                    priceAtOrder: parseFloat(item.priceAtOrder.toString()), // Convertir Decimal en number
                    name: item.product?.name || 'Produit Inconnu',
                    imgUrl: imgArray.length > 0 ? imgArray[0] : '/placeholder-product.png', // Première image ou placeholder
                };
            });

            return {
                id: order.id,
                totalAmount: parseFloat(order.totalAmount.toString()), // Convertir Decimal en number
                orderStatus: order.status, // Statut de la commande (de la table orders)
                // Utilise le statut de paiement de la table Payment si disponible, sinon celui de la table Order
                paymentStatus: order.payment?.status || order.paymentStatus, // Statut de paiement (de la table payments ou orders)
                shippingAddressLine1: order.shippingAddressLine1,
                shippingAddressLine2: order.shippingAddressLine2,
                shippingCity: order.shippingCity,
                shippingState: order.shippingState,
                shippingZipCode: order.shippingZipCode,
                shippingCountry: order.shippingCountry,
                orderDate: order.orderDate, // Prisma retourne un objet Date, qui sera sérialisé en ISO string
                userName: userName,
                userEmail: order.user?.email,
                userPhoneNumber: order.user?.phoneNumber,
                paymentMethod: order.payment?.paymentMethod,
                paymentTransactionId: order.payment?.transactionId,
                paymentDate: order.payment?.paymentDate, // Prisma retourne un objet Date
                items: items, // Articles de commande formatés
            };
        });

        return NextResponse.json(formattedOrders, { status: 200 });

    } catch (_error: unknown) { // Correction ESLint: renommé 'error' en '_error'
        const message = _error instanceof Error ? _error.message : String(_error);
        console.error("Erreur CRITIQUE dans l'API /api/admin/orders:", _error); // Afficher l'erreur complète pour le débogage
        return NextResponse.json({ message: 'Erreur serveur lors de la récupération des commandes.', error: message }, { status: 500 });
    }
    // Plus de bloc finally pour connection.release() car nous utilisons Prisma.
}