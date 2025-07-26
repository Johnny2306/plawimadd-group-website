// app/api/kkiapay-callback/route.ts

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { OrderStatus, PaymentStatus, Prisma } from '@prisma/client';
import { verifyKkiapayTransaction } from '@/lib/kkiapay';

interface VerificationResult {
    status: string;
    amount?: number;
    paymentMethod?: string;
    transactionId?: string;
    message?: string;
    currency?: string;
    state?: string;
    reason?: { code?: string; message?: string };
}

export async function GET(request: NextRequest) {
    console.log("==> Kkiapay Callback GET reçu");

    const { searchParams } = new URL(request.url);
    const orderId = searchParams.get('transactionId'); // C'est l'ID de notre commande que nous avons envoyé à Kkiapay
    const kkiapayActualTransactionId = searchParams.get('transaction_id') || searchParams.get('id'); // ID de transaction Kkiapay réel

    console.log("Params callback:", { orderId, kkiapayActualTransactionId });

    if (!orderId) {
        console.error("Callback Kkiapay: Votre ID de commande (transactionId) est manquant dans les paramètres du callback.");
        return NextResponse.redirect(`${request.nextUrl.origin}/order-status?status=error&message=${encodeURIComponent('Votre ID de commande est manquant dans le callback.')}`);
    }

    if (!kkiapayActualTransactionId) {
        console.error("Callback Kkiapay: ID de transaction Kkiapay réel manquant dans les paramètres du callback.");
        return NextResponse.redirect(`${request.nextUrl.origin}/order-status?status=error&message=${encodeURIComponent('ID de transaction Kkiapay manquant pour la vérification.')}`);
    }

    let order: Awaited<ReturnType<typeof prisma.order.findUnique>> | null = null;

    try {
        // 1. Récupérer la commande dans votre base de données en utilisant l'orderId (qui est le transactionId Kkiapay)
        // CORRECTION: Utilisation de 'id' au lieu de 'kkiapayTransactionId' pour la recherche
        order = await prisma.order.findUnique({
            where: { id: orderId },
            include: { orderItems: true }
        });

        if (!order) {
            console.error(`Erreur critique: Commande ${orderId} non trouvée dans la base de données lors du callback Kkiapay.`);
            return NextResponse.redirect(new URL(`/order-status?orderId=${orderId}&status=failed&message=${encodeURIComponent('Commande introuvable pour la finalisation du paiement. Le paiement a peut-être échoué ou la commande n\'a pas été initiée correctement.')}`, request.url));
        }

        const nonNullableOrder = order as NonNullable<typeof order>; // Assertion de type pour aider TypeScript

        // 2. Vérifier la transaction auprès de l'API Kkiapay (étape cruciale de sécurité)
        let verification: VerificationResult;
        try {
            verification = await verifyKkiapayTransaction(kkiapayActualTransactionId);
            console.log("Réponse de vérification Kkiapay:", verification);
        } catch (verifyError: unknown) {
            const errorMessage =
                verifyError instanceof Error
                    ? verifyError.message
                    : (typeof verifyError === 'object' && verifyError !== null && 'message' in verifyError
                        ? (verifyError as { message: string }).message
                        : String(verifyError));
            console.error("Erreur lors de la vérification Kkiapay:", errorMessage);

            // Tenter de mettre à jour la commande et le paiement en FAILED si la vérification échoue
            try {
                await prisma.order.update({
                    where: { id: orderId },
                    data: {
                        status: OrderStatus.PAYMENT_FAILED,
                        paymentStatus: PaymentStatus.FAILED,
                        updatedAt: new Date(),
                    },
                });
                await prisma.payment.update({
                    where: { orderId: orderId },
                    data: {
                        status: PaymentStatus.FAILED,
                        updatedAt: new Date(),
                    }
                });
                console.log(`Commande ${orderId} et paiement mis à jour en FAILED suite à l'échec de vérification.`);
            } catch (dbUpdateError) {
                console.error(`Erreur lors de la mise à jour de la commande/paiement en FAILED après échec de vérification:`, dbUpdateError);
            }

            return NextResponse.redirect(
                `${request.nextUrl.origin}/order-status?orderId=${orderId}&status=failed&message=${encodeURIComponent(
                    'Erreur lors de la vérification du paiement Kkiapay: ' + (errorMessage || 'Erreur inconnue.')
                )}`
            );
        }

        const isSuccess = verification.status === 'SUCCESS' && verification.state === 'COMPLETED';
        const kkiapayTransactionAmount = verification.amount || 0;
        const kkiapayPaymentMethod = verification.paymentMethod || 'Mobile Money';
        const kkiapayVerifiedTransactionId = verification.transactionId || kkiapayActualTransactionId;

        let finalOrderStatus: OrderStatus;
        let finalPaymentStatus: PaymentStatus;
        let redirectMessage: string = '';

        if (isSuccess) {
            finalOrderStatus = OrderStatus.PAID_SUCCESS;
            finalPaymentStatus = PaymentStatus.COMPLETED;
            redirectMessage = 'Paiement réussi ! Votre commande est en cours de traitement.';
        } else {
            finalOrderStatus = OrderStatus.PAYMENT_FAILED;
            finalPaymentStatus = PaymentStatus.FAILED;
            redirectMessage = verification.reason?.message || verification.message || 'Le paiement a échoué ou a été annulé.';
        }

        await prisma.$transaction(async (prismaTx) => {
            // Mettre à jour le statut de la commande
            await prismaTx.order.update({
                where: { id: orderId },
                data: {
                    status: finalOrderStatus,
                    paymentStatus: finalPaymentStatus,
                    updatedAt: new Date(),
                },
            });
            console.log(`Commande ${orderId} mise à jour. Statut: ${finalOrderStatus}, Paiement: ${finalPaymentStatus}`);

            // Mettre à jour l'enregistrement de paiement (upsert pour être robuste)
            const paymentAmountDecimal = new Prisma.Decimal(kkiapayTransactionAmount);
            await prismaTx.payment.upsert({
                where: { orderId: orderId },
                update: {
                    paymentMethod: kkiapayPaymentMethod,
                    transactionId: kkiapayVerifiedTransactionId,
                    amount: paymentAmountDecimal,
                    currency: verification.currency || nonNullableOrder.currency,
                    status: finalPaymentStatus,
                    paymentDate: new Date(),
                    updatedAt: new Date(),
                },
                create: {
                    orderId: orderId,
                    paymentMethod: kkiapayPaymentMethod,
                    transactionId: kkiapayVerifiedTransactionId,
                    amount: paymentAmountDecimal,
                    currency: verification.currency || nonNullableOrder.currency,
                    status: finalPaymentStatus,
                    paymentDate: new Date(),
                    createdAt: new Date(),
                    updatedAt: new Date(),
                }
            });
            console.log(`Paiement pour commande ${orderId} mis à jour/créé.`);

            // Vider le panier de l'utilisateur si le paiement est réussi
            if (isSuccess && nonNullableOrder.userId) {
                await prismaTx.cartItem.deleteMany({
                    where: { userId: nonNullableOrder.userId },
                });
                console.log(`Panier de l'utilisateur ${nonNullableOrder.userId} vidé suite au succès du paiement.`);
            }
        });

        const redirectUrl = isSuccess
            ? `${request.nextUrl.origin}/order-status?orderId=${orderId}&status=success`
            : `${request.nextUrl.origin}/order-status?orderId=${orderId}&status=failed&message=${encodeURIComponent(redirectMessage)}`;

        return NextResponse.redirect(redirectUrl);

    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error("Erreur générale lors du traitement du callback Kkiapay:", errorMessage);

        return NextResponse.redirect(
            `${request.nextUrl.origin}/order-status?orderId=${orderId}&status=failed&message=${encodeURIComponent('Erreur serveur interne lors du traitement du paiement: ' + errorMessage)}`
        );
    }
}

export async function POST(request: NextRequest) {
    console.log("Kkiapay Callback POST reçu → redirection vers GET");
    return GET(request);
}
