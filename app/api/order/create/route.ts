// app/api/order/create/route.ts
// Cette route gère la création initiale d'une nouvelle commande par un utilisateur authentifié.

import { NextResponse, NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { OrderStatus, PaymentStatus, Prisma } from '@prisma/client';
import { authorizeLoggedInUser, AuthResult } from '@/lib/authUtils';

// Interfaces mises à jour pour correspondre aux types Prisma et aux besoins
interface AddressPayload {
    area: string;
    pincode?: string | null;
    city: string;
    state: string;
    street?: string | null;
    country?: string;
    id?: number | null; // L'ID d'adresse est un INT dans schema.prisma
}

interface OrderItemPayload {
    productId: string;
    quantity: number;
    price: number; // Prix unitaire au moment de la commande
}

interface CreateOrderRequestData {
    id: string; // L'ID de transaction Kkiapay généré par le frontend, qui sera aussi l'ID de la commande
    items: OrderItemPayload[];
    totalAmount: number;
    currency?: string;
    shippingAddress: AddressPayload;
    paymentMethod: string;
    userEmail: string;
    userPhoneNumber?: string | null; // CORRECTION: Rendu nullable
}

export async function POST(req: NextRequest): Promise<NextResponse> {
    // 1. Authentification de l'utilisateur
    const authResult: AuthResult = await authorizeLoggedInUser(req);
    if (!authResult.authorized) {
        return authResult.response!;
    }
    const userId = authResult.userId!; // L'ID de l'utilisateur authentifié

    try {
        const orderData: CreateOrderRequestData = await req.json();
        console.log("[API/order/create] Received payload:", orderData);

        // 2. Validation des données
        if (
            !orderData ||
            !orderData.id || // L'ID de commande/transaction est maintenant obligatoire
            !orderData.items ||
            orderData.items.length === 0 ||
            orderData.totalAmount === undefined ||
            !orderData.shippingAddress ||
            !orderData.paymentMethod ||
            !orderData.userEmail
        ) {
            console.error("[API/order/create] Données de commande incomplètes ou manquantes:", orderData);
            return NextResponse.json({ message: 'Données de commande incomplètes ou manquantes.' }, { status: 400 });
        }

        // Tente de lier à une adresse existante si un ID est fourni et est un nombre valide
        let existingAddressId: number | null = null;
        if (orderData.shippingAddress.id !== undefined && orderData.shippingAddress.id !== null) {
            const parsedId = parseInt(String(orderData.shippingAddress.id), 10);
            if (!isNaN(parsedId)) {
                existingAddressId = parsedId;
            }
        }

        // Utilisation de la transaction Prisma pour garantir l'atomicité
        const newOrder = await prisma.$transaction(async (prismaTx) => {
            // Préparation des OrderItems pour la création imbriquée
            const orderItemsForPrisma = orderData.items.map(item => ({
                productId: item.productId,
                quantity: item.quantity,
                priceAtOrder: new Prisma.Decimal(item.price), // Convertir en Decimal
            }));

            // Création de la commande principale
            const createdOrder = await prismaTx.order.create({
                data: {
                    id: orderData.id, // Utilise l'ID de transaction Kkiapay comme ID de commande
                    userId: userId, // Utilisation de l'ID de l'utilisateur authentifié
                    totalAmount: new Prisma.Decimal(orderData.totalAmount), // Convertir en Decimal

                    status: OrderStatus.PENDING, // Statut initial de la commande
                    paymentStatus: PaymentStatus.PENDING, // Statut initial du paiement

                    // Champs d'adresse de livraison directement sur la commande (snapshot)
                    shippingAddressLine1: orderData.shippingAddress.street || orderData.shippingAddress.area || '',
                    shippingAddressLine2: orderData.shippingAddress.area || null,
                    shippingCity: orderData.shippingAddress.city,
                    shippingState: orderData.shippingAddress.state,
                    shippingZipCode: orderData.shippingAddress.pincode || null,
                    shippingCountry: orderData.shippingAddress.country || 'Bénin', // Valeur par défaut si non fournie

                    userEmail: orderData.userEmail,
                    userPhoneNumber: orderData.userPhoneNumber || null, // CORRECTION: Utilise || null pour les valeurs vides/undefined
                    currency: orderData.currency || 'XOF', // Devise par défaut

                    // Création imbriquée des OrderItems
                    orderItems: {
                        create: orderItemsForPrisma,
                    },
                    // Liaison à l'adresse existante si un ID valide est trouvé
                    shippingAddressId: existingAddressId,
                },
                include: {
                    orderItems: true,
                    shippingAddress: true,
                }
            });
            console.log(`[API/order/create] Order ${createdOrder.id} created with PENDING status.`);

            // Création du paiement initial (PENDING)
            await prismaTx.payment.create({
                data: {
                    orderId: createdOrder.id, // Lier au nouvel ID de commande
                    amount: new Prisma.Decimal(orderData.totalAmount),
                    currency: orderData.currency || 'XOF',
                    paymentMethod: orderData.paymentMethod,
                    status: PaymentStatus.PENDING,
                    transactionId: orderData.id, // L'ID de transaction Kkiapay
                    paymentDate: new Date(),
                },
            });
            console.log(`[API/order/create] Initial payment record created for order ${createdOrder.id}.`);

            return createdOrder; // Retourne la commande créée
        });

        return NextResponse.json(
            {
                success: true,
                message: 'Commande et paiement enregistrés avec succès.',
                orderId: newOrder.id,
            },
            { status: 201 }
        );
    } catch (error: unknown) {
        console.error('Erreur API /order/create:', error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        return NextResponse.json({ message: 'Erreur serveur lors de la création de la commande: ' + errorMessage }, { status: 500 });
    }
}
