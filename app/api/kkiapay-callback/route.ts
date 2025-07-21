// app/api/kkiapay-callback/route.ts
// Gère la redirection de Kkiapay après le paiement et la mise à jour finale de la commande et du paiement.

import { NextResponse, NextRequest } from 'next/server';
import prisma from '@/lib/prisma'; // Importez votre client Prisma
import { OrderStatus, PaymentStatus, Prisma } from '@prisma/client'; // Importez les enums et Prisma
import { verifyKkiapayTransaction } from '@/lib/kkiapay'; // Assurez-vous que cette fonction utilise l'API privée Kkiapay

// CORRECTION 1: Supprimé car KKIA_PRIVATE_API_KEY n'est pas utilisé directement dans ce fichier.
// Il est censé être utilisé INTERNEMENT par verifyKkiapayTransaction dans lib/kkiapay.ts
// const KKIA_PRIVATE_API_KEY = process.env.KKIAPAY_PRIVATE_API_KEY;

interface ShippingAddress {
    fullName?: string;
    area?: string;
    city?: string;
    state?: string;
    pincode?: string;
    country?: string;
    id?: string | null;
}

interface OrderItem {
    productId: string;
    quantity: number;
    price: number;
}

interface OrderPayload {
    userId?: string;
    items?: OrderItem[];
    shippingAddress?: ShippingAddress;
    totalAmount?: number;
    currency?: string;
    userEmail?: string;
    userPhoneNumber?: string;
}

interface VerificationResult {
    status: string;
    amount?: number;
    paymentMethod?: string;
    transactionId?: string;
    data?: string; // JSON string contenant payload commande
    message?: string;
    currency?: string; // CORRECTION 3: Ajout de la propriété 'currency'
}

export async function GET(request: NextRequest) {
    console.log("==> Kkiapay Callback GET reçu");

    const { searchParams } = new URL(request.url);
    const yourGeneratedOrderId = searchParams.get('transactionId');
    const kkiapayActualTransactionId = searchParams.get('transaction_id') || searchParams.get('id');
    const statusFromKkiapayCallback = searchParams.get('status');

    console.log("Params callback:", { yourGeneratedOrderId, kkiapayActualTransactionId, statusFromKkiapayCallback });

    const transactionIdToVerify = kkiapayActualTransactionId;
    const orderId = yourGeneratedOrderId;

    if (!transactionIdToVerify) {
        console.error("Callback Kkiapay: ID de transaction Kkiapay réel manquant.");
        return NextResponse.redirect(`${request.nextUrl.origin}/order-status?status=error&message=${encodeURIComponent('ID de transaction Kkiapay manquant pour la vérification.')}`);
    }
    if (!orderId) {
        console.error("Callback Kkiapay: Votre ID de commande est manquant (transactionId dans le callback Kkiapay).");
        return NextResponse.redirect(`${request.nextUrl.origin}/order-status?status=error&message=${encodeURIComponent('Votre ID de commande est manquant dans le callback.')}`);
    }

    try {
        let verification: VerificationResult;
        try {
            verification = await verifyKkiapayTransaction(transactionIdToVerify);
            console.log("Réponse vérifiée du SDK Kkiapay:", verification);
        } catch (verifyError: unknown) {
            const errorMessage =
                typeof verifyError === 'object' && verifyError !== null && 'message' in verifyError
                    ? (verifyError as { message: string }).message
                    : String(verifyError);
            console.error("Erreur vérification Kkiapay (via SDK):", errorMessage);
            return NextResponse.redirect(
                `${request.nextUrl.origin}/order-status?orderId=${orderId}&status=failed&message=${encodeURIComponent(
                    'Erreur lors de la vérification Kkiapay: ' + (errorMessage || 'Erreur inconnue.')
                )}`
            );
        }

        const isSuccess = verification.status === 'SUCCESS';
        const kkiapayTransactionAmount = verification.amount || 0;
        const kkiapayPaymentMethod = verification.paymentMethod || 'Mobile Money';
        const kkiapayActualTransactionIdFromSDK = verification.transactionId || transactionIdToVerify;

        // CORRECTION 2: Renommé _orderPayload pour supprimer le warning si non utilisé.
        // On l'utilise ici pour potentiellement récupérer l'userId pour vider le panier.
        let _orderPayload: OrderPayload | null = null;
        if (verification.data) {
            try {
                _orderPayload = JSON.parse(verification.data);
            } catch (parseErr: unknown) {
                const errorMessage = typeof parseErr === 'object' && parseErr !== null && 'message' in parseErr
                    ? (parseErr as { message: string }).message
                    : String(parseErr);
                console.warn("Erreur parsing data (payload Kkiapay):", errorMessage);
            }
        }

        await prisma.$transaction(async (prismaTx) => {
            const existingOrder = await prismaTx.order.findUnique({
                where: { id: orderId },
            });

            if (!existingOrder) {
                console.error(`Erreur critique: Commande ${orderId} non trouvée dans la base de données lors du callback Kkiapay.`);
                throw new Error('Commande introuvable pour la finalisation du paiement.');
            }

            const finalOrderStatus = isSuccess ? OrderStatus.PAID_SUCCESS : OrderStatus.PAYMENT_FAILED;
            const finalPaymentStatus = isSuccess ? PaymentStatus.COMPLETED : PaymentStatus.FAILED;

            const updatedOrder = await prismaTx.order.update({
                where: { id: orderId },
                data: {
                    status: finalOrderStatus,
                    paymentStatus: finalPaymentStatus,
                    kakapayTransactionId: kkiapayActualTransactionIdFromSDK,
                    updatedAt: new Date(),
                },
            });
            console.log(`Commande ${updatedOrder.id} mise à jour. Statut: ${finalOrderStatus}, Paiement: ${finalPaymentStatus}`);

            const paymentAmountDecimal = new Prisma.Decimal(kkiapayTransactionAmount);

            const upsertedPayment = await prismaTx.payment.upsert({
                where: { orderId: orderId },
                update: {
                    paymentMethod: kkiapayPaymentMethod,
                    transactionId: kkiapayActualTransactionIdFromSDK,
                    amount: paymentAmountDecimal,
                    currency: verification.currency || existingOrder.currency,
                    status: finalPaymentStatus,
                    paymentDate: new Date(),
                    updatedAt: new Date(),
                },
                create: {
                    orderId: orderId,
                    paymentMethod: kkiapayPaymentMethod,
                    transactionId: kkiapayActualTransactionIdFromSDK,
                    amount: paymentAmountDecimal,
                    currency: verification.currency || existingOrder.currency,
                    status: finalPaymentStatus,
                    paymentDate: new Date(),
                    createdAt: new Date(),
                    updatedAt: new Date(),
                },
            });
            console.log(`Paiement pour commande ${orderId} upserté. ID transaction Kkiapay: ${upsertedPayment.transactionId}`);

            // Vider le panier si le paiement est un succès et si l'userId est disponible
            // Utiliser existingOrder.userId car c'est la source la plus fiable pour l'utilisateur de la commande
            // ou _orderPayload.userId si existingOrder.userId est null et _orderPayload.userId existe.
            if (isSuccess && (existingOrder.userId || _orderPayload?.userId)) {
                await prismaTx.cartItem.deleteMany({
                    where: {
                        userId: existingOrder.userId || _orderPayload?.userId // Prioriser l'ID de la commande, sinon celui du payload
                    },
                });
                console.log(`Panier de l'utilisateur ${existingOrder.userId || _orderPayload?.userId} vidé suite au succès du paiement.`);
            }
        });

        const redirectUrl = isSuccess
            ? `${request.nextUrl.origin}/order-status?orderId=${orderId}&status=success`
            : `${request.nextUrl.origin}/order-status?orderId=${orderId}&status=failed&message=${encodeURIComponent(verification.message || 'Échec du paiement Kkiapay')}`;

        return NextResponse.redirect(redirectUrl);

    } catch (_error: unknown) {
        const errorMessage = _error instanceof Error ? _error.message : String(_error);
        console.error("Erreur générale lors du traitement du callback Kkiapay:", errorMessage);

        if (
            typeof _error === 'object' &&
            _error !== null &&
            'code' in _error &&
            (_error as { code?: string }).code === 'P2025'
        ) {
            return NextResponse.redirect(
                `${request.nextUrl.origin}/order-status?status=error&message=${encodeURIComponent('Erreur: Commande ou paiement non trouvé.')}`
            );
        }

        return NextResponse.redirect(
            `${request.nextUrl.origin}/order-status?status=error&message=${encodeURIComponent('Erreur serveur interne lors du traitement du paiement.')}`
        );
    }
}

export async function POST(request: NextRequest) {
    console.log("Kkiapay Callback POST reçu → redirection vers GET");
    return GET(request);
}