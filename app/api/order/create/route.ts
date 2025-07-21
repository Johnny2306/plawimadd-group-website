// C:\xampp\htdocs\plawimadd_group\app\api\order\create\route.ts
// Cette route gère la création initiale d'une nouvelle commande par un utilisateur authentifié.

import { NextResponse, NextRequest } from 'next/server';
import prisma from '@/lib/prisma'; // Importez votre client Prisma
import { OrderStatus, PaymentStatus, Prisma } from '@prisma/client'; // Importez les enums et Prisma
import { authorizeLoggedInUser, AuthResult } from '@/lib/authUtils'; // Importez la fonction d'autorisation utilisateur

// Les imports mysql2/promise et randomUUID ne sont plus nécessaires
// import mysql from 'mysql2/promise';
// import { randomUUID } from 'crypto';

// dbConfig n'est plus nécessaire car Prisma gère la connexion via DATABASE_URL
// const dbConfig = {
//   host: process.env.DB_HOST,
//   user: process.env.DB_USER,
//   password: process.env.DB_PASSWORD,
//   database: process.env.DB_NAME,
// };

// Interfaces mises à jour pour correspondre aux types Prisma et aux besoins
interface AddressPayload {
    area: string;
    pincode?: string | null; // Peut être null
    city: string;
    state: string;
    street?: string | null; // Ajouté pour être cohérent avec votre Address model
    country?: string; // Ajouté pour être cohérent avec votre Address model
    id?: string | null; // Si vous passez un ID d'adresse existante
}

interface OrderItemPayload {
    productId: string;
    quantity: number;
    price: number; // Prix unitaire au moment de la commande
}

interface CreateOrderRequestData {
    // userId n'est plus nécessaire dans le payload, il sera récupéré via l'authentification
    items: OrderItemPayload[];
    totalAmount: number; // Montant total de la commande
    currency?: string;
    shippingAddress: AddressPayload; // Utilisation de AddressPayload pour la clarté
    paymentMethod: string; // Ex: "Kkiapay"
    transactionId?: string | null; // ID de transaction initial (peut être null au début)
    userEmail: string; // Email de l'utilisateur au moment de la commande
    userPhoneNumber: string; // Numéro de téléphone de l'utilisateur au moment de la commande
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

        // 2. Validation des données
        if (
            !orderData ||
            !orderData.items ||
            orderData.items.length === 0 ||
            orderData.totalAmount === undefined || // totalAmount peut être 0
            !orderData.shippingAddress ||
            !orderData.paymentMethod ||
            !orderData.userEmail ||
            !orderData.userPhoneNumber
        ) {
            return NextResponse.json({ message: 'Données de commande incomplètes ou manquantes.' }, { status: 400 });
        }

        // Utilisation de la transaction Prisma pour garantir l'atomicité
        const newOrder = await prisma.$transaction(async (prismaTx) => {
            // Prisma génère automatiquement l'UUID pour l'ID de la commande si @default(uuid()) est configuré.
            // Pas besoin de randomUUID() manuellement ici.

            // Préparation des OrderItems pour la création imbriquée
            const orderItemsForPrisma = orderData.items.map(item => ({
                productId: item.productId,
                quantity: item.quantity,
                priceAtOrder: new Prisma.Decimal(item.price), // Convertir en Decimal
            }));

            // Création de la commande principale
            const createdOrder = await prismaTx.order.create({
                data: {
                    userId: userId, // Utilisation de l'ID de l'utilisateur authentifié
                    totalAmount: new Prisma.Decimal(orderData.totalAmount), // Convertir en Decimal
                    kakapayTransactionId: orderData.transactionId || null, // Peut être null au début
                    status: OrderStatus.PENDING, // Statut initial de la commande
                    paymentStatus: PaymentStatus.PENDING, // Statut initial du paiement

                    // Champs d'adresse de livraison directement sur la commande (snapshot)
                    shippingAddressLine1: orderData.shippingAddress.area,
                    shippingAddressLine2: orderData.shippingAddress.street || null, // Utilisez 'street'
                    shippingCity: orderData.shippingAddress.city,
                    shippingState: orderData.shippingAddress.state,
                    shippingZipCode: orderData.shippingAddress.pincode || null, // Peut être null
                    shippingCountry: orderData.shippingAddress.country || 'Unknown', // Assurez-vous d'une valeur par défaut ou de null

                    userEmail: orderData.userEmail,
                    userPhoneNumber: orderData.userPhoneNumber,
                    currency: orderData.currency || 'XOF', // Devise par défaut

                    // Création imbriquée des OrderItems
                    orderItems: {
                        create: orderItemsForPrisma,
                    },
                },
                include: { // Inclure les relations pour la réponse si nécessaire
                    orderItems: true,
                    // shippingAddress: true, // Si vous liez à une Address existante, sinon non
                }
            });

            // Création du paiement initial (PENDING)
            await prismaTx.payment.create({
                data: {
                    orderId: createdOrder.id, // Lier au nouvel ID de commande
                    amount: new Prisma.Decimal(orderData.totalAmount),
                    currency: orderData.currency || 'XOF',
                    paymentMethod: orderData.paymentMethod,
                    status: PaymentStatus.PENDING,
                    transactionId: orderData.transactionId || null, // Peut être null au début
                    paymentDate: new Date(), // Date de création du paiement
                },
            });

            return createdOrder; // Retourne la commande créée
        });

        return NextResponse.json(
            {
                success: true,
                message: 'Commande et paiement enregistrés avec succès.',
                orderId: newOrder.id, // Utiliser l'ID généré par Prisma
            },
            { status: 201 } // 201 Created est plus approprié pour une création
        );
    } catch (_error: unknown) { // Correction ESLint: renommé 'error' en '_error'
        console.error('Erreur API /order/create:', _error);
        const errorMessage = _error instanceof Error ? _error.message : String(_error);
        return NextResponse.json({ message: 'Erreur serveur lors de la création de la commande: ' + errorMessage }, { status: 500 });
    }
    // Pas de bloc finally pour connection.end() car Prisma gère ses propres connexions.
}