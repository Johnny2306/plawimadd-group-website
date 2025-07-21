// C:\xampp\htdocs\plawimadd_group\app\api\user\orders\route.ts
// Cette route gère la récupération et la création des commandes des utilisateurs.

import { NextRequest, NextResponse } from 'next/server';

import prisma from '@/lib/prisma'; // Importez votre client Prisma
import { CreateOrderPayload } from '@/lib/types';

// Importez les enums directement
import { OrderStatus, PaymentStatus } from '@prisma/client';

// IMPORTATION DES FONCTIONS ET INTERFACES D'AUTHUTILS
// Utilisez authorizeLoggedInUser car cette route n'est PAS dynamique (pas de [userId] dans l'URL)
import { authorizeLoggedInUser, AuthResult } from '@/lib/authUtils';


/**
 * GET /api/user/orders
 * Récupère toutes les commandes pour l'utilisateur actuellement authentifié.
 * Nécessite une authentification.
 * @param {NextRequest} req La requête Next.js entrante.
 * @returns {Promise<NextResponse>} La réponse JSON avec les commandes ou un message d'erreur.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
    // CORRECTION : Utiliser authorizeLoggedInUser car cette route n'a pas de paramètre userId dans l'URL
    const authResult: AuthResult = await authorizeLoggedInUser(req);
    if (!authResult.authorized) {
        return authResult.response!;
    }
    const userId = authResult.userId!; // Récupère l'ID de l'utilisateur authentifié

    try {
        const orders = await prisma.order.findMany({
            where: { userId: userId },
            orderBy: { createdAt: 'desc' },
            include: {
                orderItems: { // Inclut les OrderItems liés à chaque commande
                    include: {
                        product: true, // Inclut les détails du produit pour chaque OrderItem
                    }
                },
                shippingAddress: true, // Inclut l'adresse de livraison liée si elle existe
                payment: true, // Inclut les détails de paiement si besoin
            }
        });

        // Optionnel: Formater les montants décimaux et les dates si nécessaire pour le frontend
        const formattedOrders = orders.map(order => ({
            ...order,
            totalAmount: parseFloat(order.totalAmount.toString()),
            orderItems: order.orderItems.map(item => ({
                ...item,
                priceAtOrder: parseFloat(item.priceAtOrder.toString()),
                // Vous pouvez ajouter ici des champs du produit si vous en avez besoin directement sur l'item de commande
                productName: item.product?.name,
                productImgUrl: item.product?.imgUrl,
            })),
            orderDate: order.orderDate.toISOString(), // Convertir Date en string ISO
            createdAt: order.createdAt.toISOString(),
            updatedAt: order.updatedAt.toISOString(),
        }));


        return NextResponse.json({ success: true, orders: formattedOrders }, { status: 200 });
    } catch (_error: unknown) {
        console.error("Erreur lors de la récupération des commandes:", _error);
        const errorMessage = _error instanceof Error ? _error.message : String(_error);
        return NextResponse.json({ success: false, message: "Erreur serveur lors de la récupération des commandes.", error: errorMessage }, { status: 500 });
    }
}

/**
 * POST /api/user/orders
 * Crée une nouvelle commande pour l'utilisateur actuellement authentifié.
 * Nécessite une authentification.
 * @param {NextRequest} req La requête Next.js entrante, contenant le payload de la commande.
 * @returns {Promise<NextResponse>} La réponse JSON avec le statut de la commande ou un message d'erreur.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
    // CORRECTION : Utiliser authorizeLoggedInUser pour la création de commande
    const authResult: AuthResult = await authorizeLoggedInUser(req);
    if (!authResult.authorized) {
        return authResult.response!;
    }
    const userId = authResult.userId!; // Récupère l'ID de l'utilisateur authentifié

    try {
        const payload: CreateOrderPayload = await req.json();

        const {
            items,
            totalAmount,
            shippingAddress,
            paymentMethod,
            transactionId,
            userEmail,
            userPhoneNumber,
            currency,
        } = payload;

        // Validation des données de la commande
        if (!items || items.length === 0 || totalAmount === undefined || !shippingAddress || !paymentMethod || !userEmail || !userPhoneNumber || !currency) {
            return NextResponse.json({ success: false, message: 'Données de commande incomplètes ou manquantes.' }, { status: 400 });
        }

        const orderItemsForPrisma = items.map(item => ({
            productId: item.productId,
            quantity: item.quantity,
            priceAtOrder: item.price,
        }));

        // Optionnel: Vérifier si l'adresse de livraison existe déjà dans la DB pour la lier
        // Si non, vous devrez la créer ou la gérer comme un snapshot direct sur la commande
        // Votre schéma actuel met les champs d'adresse directement sur la commande, ce qui est bien pour un snapshot.

        const newOrder = await prisma.order.create({
            data: {
                userId: userId,
                totalAmount: totalAmount,
                kakapayTransactionId: transactionId,

                status: OrderStatus.PENDING,
                paymentStatus: PaymentStatus.PENDING,

                // Champs d'adresse de livraison directement sur la commande
                shippingAddressLine1: shippingAddress.area,
                shippingAddressLine2: shippingAddress.street || null,
                shippingCity: shippingAddress.city,
                shippingState: shippingAddress.state,
                shippingZipCode: shippingAddress.pincode,
                shippingCountry: shippingAddress.country || 'Unknown', // Assurez-vous que 'country' est géré

                userEmail: userEmail,
                userPhoneNumber: userPhoneNumber,
                currency: currency,

                orderItems: {
                    create: orderItemsForPrisma,
                },
                // Si vous voulez lier à une adresse existante, vous devriez ajouter shippingAddressId ici
                // et potentiellement créer l'adresse si elle n'existe pas.
                // shippingAddress: { connect: { id: shippingAddress.id } } // Si Address.id est un Int
                // shippingAddress: { connect: { id: parseInt(shippingAddress.id) } } // Si Address.id est un Int et vient en string
            },
            include: {
                orderItems: true,
                shippingAddress: true, // Inclut l'adresse liée si shippingAddressId est fourni
                payment: true, // Inclut le paiement si créé en même temps (moins courant pour la création initiale)
            }
        });

        return NextResponse.json({ success: true, message: 'Commande créée avec succès.', order: newOrder }, { status: 201 });
    } catch (_error: unknown) {
        console.error("Erreur lors de la création de la commande:", _error);
        const errorMessage = _error instanceof Error ? _error.message : String(_error);
        return NextResponse.json({ success: false, message: "Erreur serveur lors de la création de la commande.", error: errorMessage }, { status: 500 });
    }
}