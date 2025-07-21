// C:\xampp\htdocs\plawimadd_group\app\api\order\user-orders\route.ts
// Cette route récupère les commandes de l'utilisateur actuellement authentifié.

import { NextResponse, NextRequest } from 'next/server';
import prisma from '@/lib/prisma'; // Importez votre client Prisma
import { authorizeLoggedInUser, AuthResult } from '@/lib/authUtils'; // Importez la fonction d'autorisation utilisateur

// Les imports de jwt, db, RowDataPacket ne sont plus nécessaires
// const JWT_SECRET = process.env.JWT_SECRET || 'votre_cle_secrete_jwt';
// interface JwtPayload { ... }
// function verifyToken(...) { ... }


interface OrderItemDisplay {
    name: string;
    quantity: number;
    priceAtOrder: number;
    imgUrl?: string; // Ajouté pour afficher l'image du produit
}

// IMPORTANT: Changer la méthode de POST à GET pour la récupération de données
export async function GET(request: NextRequest): Promise<NextResponse> {
    // 1. Authentification de l'utilisateur
    const authResult: AuthResult = await authorizeLoggedInUser(request);
    if (!authResult.authorized) {
        // La fonction authorizeLoggedInUser gère déjà les messages d'erreur appropriés (401, 403)
        return authResult.response!;
    }
    const userId = authResult.userId!; // L'ID de l'utilisateur authentifié

    try {
        // 2. Récupération des commandes de l'utilisateur via Prisma
        const orders = await prisma.order.findMany({
            where: { userId: userId },
            orderBy: { orderDate: 'desc' }, // Trie par la date de commande la plus récente
            include: {
                orderItems: { // Inclut les articles de chaque commande
                    include: {
                        product: { // Inclut les détails du produit pour chaque article de commande
                            select: {
                                name: true,
                                imgUrl: true, // Récupère l'URL de l'image du produit
                            },
                        },
                    },
                },
                shippingAddress: true, // Inclut l'adresse de livraison associée (si liée)
                payment: { // Inclut les détails de paiement
                    select: {
                        paymentMethod: true,
                        status: true,
                        transactionId: true,
                        amount: true,
                        currency: true,
                        paymentDate: true,
                    }
                }
            },
        });

        // 3. Formater les données pour la réponse frontend
        const formattedOrders = orders.map((order) => {
            const items: OrderItemDisplay[] = order.orderItems.map((item) => {
                let imgArray: string[] = [];
                // Logique de parsing de imgUrl (si c'est un JSON string d'URLs)
                if (item.product?.imgUrl) {
                    try {
                        const parsed = JSON.parse(item.product.imgUrl);
                        if (Array.isArray(parsed)) {
                            imgArray = parsed;
                        } else if (typeof parsed === 'string') {
                            imgArray = [parsed];
                        }
                    } catch {
                        if (typeof item.product.imgUrl === 'string' && (item.product.imgUrl.startsWith('/') || item.product.imgUrl.startsWith('http'))) {
                            imgArray = [item.product.imgUrl];
                        }
                    }
                }

                return {
                    name: item.product?.name || 'Produit Inconnu',
                    quantity: item.quantity,
                    priceAtOrder: parseFloat(item.priceAtOrder.toString()), // Convertir Decimal en number
                    imgUrl: imgArray.length > 0 ? imgArray[0] : '/placeholder-product.png',
                };
            });

            return {
                id: order.id,
                totalAmount: parseFloat(order.totalAmount.toString()), // Convertir Decimal en number
                status: order.status,
                paymentStatus: order.payment?.status || order.paymentStatus, // Prioriser le statut du paiement réel
                shippingAddressLine1: order.shippingAddressLine1,
                shippingAddressLine2: order.shippingAddressLine2,
                shippingCity: order.shippingCity,
                shippingState: order.shippingState,
                shippingZipCode: order.shippingZipCode,
                shippingCountry: order.shippingCountry,
                orderDate: order.orderDate.toISOString(), // Convertir Date en string ISO
                paymentMethod: order.payment?.paymentMethod || 'N/A',
                paymentTransactionId: order.payment?.transactionId || null,
                paymentAmount: order.payment?.amount ? parseFloat(order.payment.amount.toString()) : 0,
                paymentCurrency: order.payment?.currency || 'XOF',
                paymentDate: order.payment?.paymentDate?.toISOString() || null,
                items: items,
                createdAt: order.createdAt.toISOString(),
                updatedAt: order.updatedAt.toISOString(),
            };
        });

        return NextResponse.json({ success: true, data: formattedOrders }, { status: 200 });
    } catch (_error: unknown) { // Correction ESLint: renommé 'dbError' en '_error'
        console.error('Erreur lors de la récupération des commandes utilisateur:', _error);
        const errorMessage = _error instanceof Error ? _error.message : String(_error);
        return NextResponse.json({ success: false, message: 'Erreur serveur lors de la récupération de vos commandes.', error: errorMessage }, { status: 500 });
    }
}

// Supprimé la fonction POST car elle est remplacée par GET pour la récupération.
// Si cette route était censée gérer une autre opération POST, elle devrait être séparée.