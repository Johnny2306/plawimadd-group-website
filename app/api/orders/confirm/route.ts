// C:\xampp\htdocs\plawimadd_group\app\api\orders\confirm\route.ts
// Cette route gère la confirmation finale d'une commande après un paiement réussi.

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma'; // Importez le client Prisma partagé
import { OrderStatus, PaymentStatus, Prisma } from '@prisma/client'; // Importez les enums et Prisma
import { verifyPaymentToken } from '@/lib/payment'; // Assurez-vous que cette fonction est bien typée et implémentée
import { authorizeLoggedInUser, AuthResult } from '@/lib/authUtils'; // Importez la fonction d'autorisation utilisateur

// Interfaces pour le corps de la requête
interface CartItemPayload {
    productId: string;
    quantity: number;
    price: number; // Prix unitaire au moment de l'ajout au panier
}

interface ShippingAddressPayload {
    fullName: string;
    phoneNumber: string;
    pincode: string;
    area: string;
    city: string;
    state: string;
    street?: string | null; // Rendu optionnel et peut être null
    country?: string | null; // Rendu optionnel et peut être null
}

interface PaymentDetailsPayload {
    method: string; // Ex: 'Kkiapay', 'Card', 'Mobile Money'
    currency: string; // Ex: 'XOF', 'EUR'
    transactionId?: string | null; // ID de transaction du fournisseur de paiement (peut être null si non disponible immédiatement)
}

interface ConfirmOrderRequest {
    // userId n'est plus dans le payload, il est récupéré via l'authentification
    cartItems: CartItemPayload[];
    paymentToken: string; // Jeton de vérification du paiement (ex: de Kkiapay, Stripe, etc.)
    shippingAddress: ShippingAddressPayload;
    paymentDetails: PaymentDetailsPayload;
}

/**
 * Calcule le montant total d'une liste d'articles.
 * @param items Les articles du panier.
 * @returns Le montant total.
 */
function calculateTotal(items: CartItemPayload[]): number {
    return items.reduce((sum, item) => sum + item.price * item.quantity, 0);
}

export async function POST(request: NextRequest): Promise<NextResponse> {
    // 1. Authentification de l'utilisateur
    const authResult: AuthResult = await authorizeLoggedInUser(request);
    if (!authResult.authorized) {
        return authResult.response!; // Renvoie la réponse d'erreur (401, 403)
    }
    const userId = authResult.userId!; // L'ID de l'utilisateur authentifié

    try {
        const body: ConfirmOrderRequest = await request.json();
        const { cartItems, paymentToken, shippingAddress, paymentDetails } = body;

        // 2. Validation basique des données
        if (
            !cartItems ||
            cartItems.length === 0 ||
            !paymentToken ||
            !shippingAddress ||
            !shippingAddress.fullName ||
            !shippingAddress.phoneNumber ||
            !shippingAddress.area ||
            !shippingAddress.city ||
            !shippingAddress.state ||
            !paymentDetails ||
            !paymentDetails.method ||
            !paymentDetails.currency
        ) {
            return NextResponse.json({ error: 'Requête invalide : données de commande, adresse ou paiement manquantes.' }, { status: 400 });
        }

        const totalAmountCalculated = calculateTotal(cartItems);

        // 3. Vérifier le paiement auprès du fournisseur
        // Cette fonction doit communiquer avec l'API du fournisseur de paiement pour confirmer la validité du token/transaction.
        const isValidPayment = await verifyPaymentToken(paymentToken);
        if (!isValidPayment) {
            console.warn(`Paiement invalide pour l'utilisateur ${userId} avec token ${paymentToken}.`);
            return NextResponse.json({ error: 'Paiement invalide ou non vérifié par le fournisseur.' }, { status: 400 });
        }

        // 4. Enregistrer la commande et le paiement dans une transaction Prisma
        const order = await prisma.$transaction(async (prismaTx) => {
            // Création des OrderItems pour la création imbriquée
            const orderItemsForPrisma = cartItems.map(item => ({
                productId: item.productId,
                quantity: item.quantity,
                priceAtOrder: new Prisma.Decimal(item.price), // Convertir en Decimal
            }));

            // Création de la commande
            const createdOrder = await prismaTx.order.create({
                data: {
                    userId: userId, // Utilisateur authentifié
                    status: OrderStatus.PAID_SUCCESS, // Statut initial après vérification du paiement
                    paymentStatus: PaymentStatus.COMPLETED, // Statut de paiement initial
                    totalAmount: new Prisma.Decimal(totalAmountCalculated), // Montant total calculé

                    // Détails de l'adresse de livraison (snapshot sur la commande)
                    shippingAddressLine1: shippingAddress.area, // Utilisation de 'area' pour line1
                    shippingAddressLine2: shippingAddress.street || null, // 'street' pour line2
                    shippingCity: shippingAddress.city,
                    shippingState: shippingAddress.state,
                    shippingZipCode: shippingAddress.pincode || null,
                    shippingCountry: shippingAddress.country || 'Unknown', // Valeur par défaut si non fournie

                    userEmail: (await prismaTx.user.findUnique({ where: { id: userId }, select: { email: true } }))?.email || 'unknown@example.com', // Récupérer l'email de l'utilisateur
                    userPhoneNumber: (await prismaTx.user.findUnique({ where: { id: userId }, select: { phoneNumber: true } }))?.phoneNumber || null, // Récupérer le numéro de téléphone

                    currency: paymentDetails.currency,
                    kakapayTransactionId: paymentDetails.transactionId || null, // ID de transaction du fournisseur

                    // Création imbriquée des articles de commande
                    orderItems: {
                        create: orderItemsForPrisma,
                    },
                },
                include: { // Inclure les orderItems dans la réponse si nécessaire
                    orderItems: true,
                }
            });

            // Enregistrer le paiement
            await prismaTx.payment.create({
                data: {
                    orderId: createdOrder.id,
                    amount: new Prisma.Decimal(totalAmountCalculated),
                    paymentMethod: paymentDetails.method,
                    currency: paymentDetails.currency,
                    status: PaymentStatus.COMPLETED,
                    transactionId: paymentDetails.transactionId || null,
                    paymentDate: new Date(),
                },
            });

            // Vider le panier de l'utilisateur après une commande réussie
            await prismaTx.cartItem.deleteMany({
                where: { userId: userId },
            });
            console.log(`Panier de l'utilisateur ${userId} vidé après la confirmation de la commande ${createdOrder.id}.`);

            return createdOrder; // Retourne l'objet commande créé
        });

        return NextResponse.json({ success: true, orderId: order.id }, { status: 201 });
    } catch (_error: unknown) { // Correction ESLint: renommé 'err' en '_error'
        const errorMessage = _error instanceof Error ? _error.message : String(_error);
        console.error('Erreur dans /api/orders/confirm:', _error);
        return NextResponse.json({ error: `Erreur serveur lors de la confirmation de la commande: ${errorMessage}` }, { status: 500 });
    }
}