// app/api/admin/orders/route.ts
// Cette route gère la récupération et la mise à jour des commandes par les administrateurs.

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { authorizeAdminRequest, AuthResult } from '@/lib/authUtils';
// Renommer OrderStatus de lib/types pour éviter le conflit avec Prisma.OrderStatus
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { OrderStatus as CustomOrderStatus, PaymentStatus as CustomPaymentStatus } from '@/lib/types';
// CORRECTION ICI : Retrait de PaymentStatus de l'importation directe car non utilisé explicitement
import { OrderStatus, Prisma } from '@prisma/client'; // Importez OrderStatus directement, et Prisma pour les types utilitaires


// Fonction utilitaire pour parser l'URL de l'image en un tableau de chaînes
const parsePrismaImgUrl = (imgUrl: string | null): string[] => {
    if (!imgUrl) return [];
    try {
        const parsed = JSON.parse(imgUrl);
        if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0] === 'string') {
            return parsed;
        } else if (typeof parsed === 'string') {
            return [parsed];
        }
    } catch (e) {
        if (typeof imgUrl === 'string') {
            return [imgUrl];
        }
    }
    return [];
};

// Définir un type complet pour la commande incluant toutes les relations incluses dans le findMany
type OrderWithAllRelations = Prisma.OrderGetPayload<{
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

// GET: Récupérer toutes les commandes (avec filtre de statut optionnel)
export async function GET(req: NextRequest): Promise<NextResponse> {
    const authResult: AuthResult = await authorizeAdminRequest(req);
    if (!authResult.authorized) return authResult.response!;

    try {
        const { searchParams } = new URL(req.url);
        const statusFilter = searchParams.get('status');

        const whereClause: Prisma.OrderWhereInput = {};

        if (statusFilter) {
            const upperStatus = statusFilter.toUpperCase();
            // Utiliser CustomOrderStatus pour la validation de l'input string
            // Puis caster vers l'OrderStatus importé directement de @prisma/client
            if (Object.values(CustomOrderStatus).includes(upperStatus as CustomOrderStatus)) {
                whereClause.status = { equals: upperStatus as OrderStatus }; // Utilise OrderStatus directement
            }
        }

        const orders: OrderWithAllRelations[] = await prisma.order.findMany({
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
                payment: true,
            },
            orderBy: { orderDate: 'desc' },
        });

        const formattedOrders = orders.map((order: OrderWithAllRelations) => {
            const userName = `${order.user?.firstName || ''} ${order.user?.lastName || ''}`.trim();

            const formattedOrderItems = order.orderItems.map((item) => ({
                productId: item.productId,
                quantity: item.quantity,
                priceAtOrder: item.priceAtOrder.toNumber(),
                product: {
                    id: item.product?.id || '',
                    name: item.product?.name || 'Produit Inconnu',
                    imgUrl: parsePrismaImgUrl(item.product?.imgUrl || null),
                    price: item.product?.price.toNumber() || 0,
                    offerPrice: item.product?.offerPrice?.toNumber() || null,
                }
            }));

            return {
                id: order.id,
                userId: order.userId,
                userName: userName || order.user?.email || 'Utilisateur Inconnu',
                userEmail: order.user?.email || '',
                totalAmount: order.totalAmount.toNumber(),
                status: order.status,
                paymentStatus: order.payment?.status || order.paymentStatus,
                orderDate: order.orderDate.toISOString(), // Ensure it's a string
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
                createdAt: order.createdAt,
                updatedAt: order.updatedAt,
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
        const { status: newStatus } = await req.json();
        const urlParts = req.nextUrl.pathname.split('/');
        const orderId = urlParts[urlParts.length - 1];

        if (!orderId || typeof orderId !== 'string' || !newStatus || typeof newStatus !== 'string') {
            return NextResponse.json({ success: false, message: 'ID de commande et statut valides sont requis.' }, { status: 400 });
        }

        const upperStatus = newStatus.toUpperCase();
        // Utiliser CustomOrderStatus pour la validation de l'input string
        if (!Object.values(CustomOrderStatus).includes(upperStatus as CustomOrderStatus)) {
            return NextResponse.json({ success: false, message: 'Statut de commande invalide.' }, { status: 400 });
        }

        const updatedOrder = await prisma.order.update({
            where: { id: orderId },
            data: {
                status: { set: upperStatus as OrderStatus }, // Utilise OrderStatus directement
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

        const deleteResult = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
            await tx.orderItem.deleteMany({
                where: { orderId: id },
            });

            await tx.payment.deleteMany({
                where: { orderId: id },
            });

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
            (_error as { code?: string }).code === 'P2025'
        ) {
            return NextResponse.json({ success: false, message: 'Commande non trouvée.' }, { status: 404 });
        }
        const message = _error instanceof Error ? _error.message : String(_error);
        return NextResponse.json({ success: false, message: 'Erreur serveur lors de la suppression de la commande.', error: message }, { status: 500 });
    }
}
