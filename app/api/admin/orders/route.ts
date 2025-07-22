// app/api/admin/orders/route.ts
// Cette route gère la récupération et la mise à jour des commandes par les administrateurs.

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { authorizeAdminRequest, AuthResult } from '@/lib/authUtils';
import { OrderStatus, PaymentStatus } from '@/lib/types'; // Importez les enums de vos types
// Removed User as PrismaUser as it was unused
import { Prisma, OrderItem as PrismaOrderItem, Payment as PrismaPayment } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

// Interface pour les articles de commande avec les détails du produit
type OrderItemWithProduct = PrismaOrderItem & {
    product: {
        id: string;
        name: string;
        imgUrl: string | null; // imgUrl est une chaîne JSON ou null dans la DB
        price: Decimal;
        offerPrice: Decimal | null;
    };
};

// Interface pour une commande avec ses relations incluses (utilisateur, articles, paiement)
type OrderWithRelations = Prisma.OrderGetPayload<{
    include: {
        user: {
            select: {
                firstName: true;
                lastName: true;
                email: true;
            };
        };
        orderItems: {
            include: {
                product: {
                    select: {
                        id: true;
                        name: true;
                        imgUrl: true;
                        price: true;
                        offerPrice: true;
                    };
                };
            };
        };
        payment: true;
    };
}>;

// Fonction utilitaire pour parser l'URL de l'image (peut être réutilisée si nécessaire)
const parsePrismaImgUrl = (imgUrl: string | null): string => {
    if (!imgUrl) return '';
    try {
        const parsed = JSON.parse(imgUrl);
        if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0] === 'string') {
            return parsed[0];
        } else if (typeof parsed === 'string') {
            return parsed;
        }
    } catch (e) {
        if (typeof imgUrl === 'string') {
            return imgUrl;
        }
    }
    return '';
};


// GET: Récupérer toutes les commandes (avec filtre de statut optionnel)
export async function GET(req: NextRequest): Promise<NextResponse> {
    const authResult: AuthResult = await authorizeAdminRequest(req);
    if (!authResult.authorized) return authResult.response!;

    try {
        const { searchParams } = new URL(req.url);
        const statusFilter = searchParams.get('status');

        const whereClause: { status?: OrderStatus } = {};

        if (statusFilter && Object.values(OrderStatus).includes(statusFilter.toUpperCase() as OrderStatus)) {
            whereClause.status = statusFilter.toUpperCase() as OrderStatus;
        }

        const orders = await prisma.order.findMany({
            where: whereClause,
            include: {
                user: {
                    select: {
                        firstName: true,
                        lastName: true,
                        email: true,
                    },
                },
                orderItems: {
                    include: {
                        product: {
                            select: {
                                id: true,
                                name: true,
                                imgUrl: true,
                                price: true,
                                offerPrice: true,
                            },
                        },
                    },
                },
                payment: true, // Inclure les informations de paiement
            },
            orderBy: { orderDate: 'desc' },
        }) as OrderWithRelations[]; // Explicit cast here to resolve type error

        // Nous devons mapper les objets Prisma pour qu'ils correspondent au format attendu par votre frontend,
        // notamment pour les champs calculés (userName) et la gestion de imgUrl.
        const formattedOrders = orders.map((order: OrderWithRelations) => {
            // Construire le nom complet de l'utilisateur
            const userName = `${order.user?.firstName || ''} ${order.user?.lastName || ''}`.trim();

            // Formater les articles de commande
            const formattedOrderItems = order.orderItems.map((item: OrderItemWithProduct) => ({ // Explicitly typed 'item'
                productId: item.productId,
                quantity: item.quantity,
                price: item.priceAtOrder.toNumber(), // Convertir Decimal en number
                name: item.product?.name || 'Produit Inconnu',
                imgUrl: parsePrismaImgUrl(item.product?.imgUrl || null),
            }));

            return {
                id: order.id,
                userId: order.userId,
                userName: userName || order.user?.email || 'Utilisateur Inconnu',
                userEmail: order.user?.email || '',
                totalAmount: order.totalAmount.toNumber(), // Convertir Decimal en number
                status: order.status,
                paymentStatus: order.payment?.status || order.paymentStatus, // Utiliser le statut de paiement du modèle Payment si disponible
                orderDate: order.orderDate.toISOString(),
                shippingAddressLine1: order.shippingAddressLine1,
                shippingAddressLine2: order.shippingAddressLine2,
                shippingCity: order.shippingCity,
                shippingState: order.shippingState,
                shippingZipCode: order.shippingZipCode,
                shippingCountry: order.shippingCountry,
                userPhoneNumber: order.userPhoneNumber,
                currency: order.currency,
                orderItems: formattedOrderItems,
                paymentMethod: order.payment?.paymentMethod || null,
                transactionId: order.payment?.transactionId || null,
                paymentDate: order.payment?.paymentDate?.toISOString() || null,
            };
        });

        return NextResponse.json(formattedOrders, { status: 200 });
    } catch (_error: unknown) {
        const message = _error instanceof Error ? _error.message : String(_error);
        console.error('Erreur GET commandes:', _error);
        return NextResponse.json({ message: 'Erreur serveur lors de la récupération des commandes.', error: message }, { status: 500 });
    }
}

// PUT: Mettre à jour le statut d'une commande
export async function PUT(req: NextRequest): Promise<NextResponse> {
    const authResult: AuthResult = await authorizeAdminRequest(req);
    if (!authResult.authorized) return authResult.response!;

    try {
        const { id, status } = await req.json();

        if (!id || typeof id !== 'string' || !status || typeof status !== 'string') {
            return NextResponse.json({ success: false, message: 'ID de commande et statut valides sont requis.' }, { status: 400 });
        }

        const upperStatus = status.toUpperCase();
        if (!Object.values(OrderStatus).includes(upperStatus as OrderStatus)) {
            return NextResponse.json({ success: false, message: 'Statut de commande invalide.' }, { status: 400 });
        }

        const updatedOrder = await prisma.order.update({
            where: { id: id },
            data: {
                status: upperStatus as OrderStatus,
                updatedAt: new Date(),
            },
        });

        return NextResponse.json({ success: true, message: 'Statut de la commande mis à jour.', order: updatedOrder }, { status: 200 });
    } catch (_error: unknown) {
        const message = _error instanceof Error ? _error.message : String(_error);
        console.error('Erreur PUT commande:', _error);
        return NextResponse.json({ success: false, message: 'Erreur serveur lors de la mise à jour du statut de la commande.', error: message }, { status: 500 });
    }
}

// DELETE: Supprimer une commande
export async function DELETE(req: NextRequest): Promise<NextResponse> {
    const authResult: AuthResult = await authorizeAdminRequest(req);
    if (!authResult.authorized) return authResult.response!;

    try {
        const { id } = await req.json();

        if (!id || typeof id !== 'string') {
            return NextResponse.json({ success: false, message: 'ID de commande valide est requis pour la suppression.' }, { status: 400 });
        }

        // Utilisation d'une transaction pour s'assurer que les OrderItems et le Payment sont supprimés en cascade
        // ou pour gérer les erreurs si ce n'est pas configuré dans le schéma Prisma.
        const deleteResult = await prisma.$transaction(async (tx: Prisma.TransactionClient) => { // Explicitly typed 'tx'
            // Supprimer les OrderItems liés à cette commande
            await tx.orderItem.deleteMany({
                where: { orderId: id },
            });

            // Supprimer le Payment lié à cette commande (si un paiement existe)
            await tx.payment.deleteMany({
                where: { orderId: id },
            });

            // Supprimer la commande elle-même
            return await tx.order.deleteMany({
                where: { id: id },
            });
        });

        if (deleteResult.count === 0) {
            return NextResponse.json({ success: false, message: 'Commande non trouvée ou déjà supprimée.' }, { status: 404 });
        }

        return NextResponse.json({ success: true, message: 'Commande supprimée avec succès.' }, { status: 200 });
    } catch (_error: unknown) {
        console.error('Erreur DELETE commande:', _error);
        if (
            typeof _error === 'object' &&
            _error !== null &&
            'code' in _error &&
            (_error as { code?: string }).code === 'P2025' // Record not found
        ) {
            return NextResponse.json({ success: false, message: 'Commande non trouvée.' }, { status: 404 });
        }
        const message = _error instanceof Error ? _error.message : String(_error);
        return NextResponse.json({ success: false, message: 'Erreur serveur lors de la suppression de la commande.', error: message }, { status: 500 });
    }
}
