// app/api/kkiapay-callback/route.ts

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { OrderStatus, PaymentStatus, Prisma } from '@prisma/client';
import crypto from 'crypto'; // Pour la vérification de la signature
import { VerificationResult, verifyKkiapayTransaction } from '@/lib/kkiapay'; // Importez la fonction de vérification Kkiapay

const KKIAPAY_SECRET = process.env.KKIAPAY_SECRET!;

export async function POST(req: NextRequest) {
    console.log("==> Kkiapay Webhook POST reçu");

    let rawBody;
    try {
        // Obtenez le corps brut de la requête pour la vérification de la signature
        rawBody = await req.text();
    } catch (e) {
        console.error("[Kkiapay Callback] Erreur de lecture du corps brut de la requête:", e);
        return NextResponse.json({ success: false, message: 'Erreur de lecture du corps de la requête.' }, { status: 400 });
    }

    const signature = req.headers.get('x-kkiapay-signature');
    console.log("[Kkiapay Webhook Debug] Signature header:", signature);
    console.log("[Kkiapay Webhook Debug] Secret env variable present:", !!KKIAPAY_SECRET);
    console.log("[Kkiapay Webhook Debug] Raw body (truncated for log):", rawBody.substring(0, 200) + (rawBody.length > 200 ? '...' : ''));

    // 1. Vérification de la signature du webhook
    if (!signature || !KKIAPAY_SECRET) {
        console.warn("[Kkiapay Callback] Signature de webhook ou secret manquant pour la validation.");
        // Ne renvoyez pas 401 directement ici pour permettre la redirection vers 'failed'
        // Continuez pour rediriger l'utilisateur, mais ne traitez pas la mise à jour DB
    } else {
        const hmac = crypto.createHmac('sha256', KKIAPAY_SECRET);
        hmac.update(rawBody);
        const digest = hmac.digest('hex');

        if (digest !== signature) {
            console.warn("[Kkiapay Callback] Signature de webhook invalide. Rejet de la requête.");
            // Continuez pour rediriger l'utilisateur vers 'failed'
            // Ne pas retourner ici pour que la redirection ait lieu
        } else {
            console.log("[Kkiapay Callback] Signature de webhook validée avec succès !");
            // La signature est valide, nous pouvons maintenant traiter le corps JSON en toute sécurité
            let kkiapayData;
            try {
                kkiapayData = JSON.parse(rawBody);
            } catch (e) {
                console.error("[Kkiapay Callback] Erreur de parsing JSON du corps du webhook:", e);
                return NextResponse.json({ success: false, message: 'Corps de webhook invalide (JSON).' }, { status: 400 });
            }

            const { transactionId, status, amount, method } = kkiapayData;

            if (!transactionId) {
                console.error("[Kkiapay Callback] transactionId manquant dans le webhook Kkiapay.");
                return NextResponse.json({ success: false, message: 'transactionId manquant.' }, { status: 400 });
            }

            // Correction: Utiliser 'const' car orderId n'est pas réassigné
            const orderId = transactionId; // Par défaut, l'ID de commande est l'ID de transaction Kkiapay

            try {
                // Optionnel: Vérifier la transaction via l'API Kkiapay pour une double validation
                // Ceci est une bonne pratique pour s'assurer que le webhook n'est pas falsifié
                const verificationResult = await verifyKkiapayTransaction(transactionId);
                console.log("[Kkiapay Callback] Résultat de la vérification Kkiapay API:", verificationResult);

                // Mettre à jour la commande dans votre base de données
                const updatedOrder = await prisma.order.update({
                    where: { id: orderId }, // Utilisez notre orderId interne
                    data: {
                        paymentStatus: status === 'SUCCESS' ? PaymentStatus.COMPLETED : PaymentStatus.FAILED,
                        // Mettre à jour le statut de la commande si nécessaire (ex: si elle était en attente de paiement)
                        // status: status === 'SUCCESS' ? OrderStatus.PROCESSING : OrderStatus.PAYMENT_FAILED,
                        updatedAt: new Date(),
                        // Enregistrer les détails de la transaction Kkiapay dans la table Payment ou Order
                        payment: {
                            upsert: {
                                where: { orderId: orderId },
                                update: {
                                    transactionId: transactionId,
                                    paymentMethod: method,
                                    amount: amount,
                                    currency: verificationResult.currency,
                                    status: status === 'SUCCESS' ? PaymentStatus.COMPLETED : PaymentStatus.FAILED,
                                    paymentDate: new Date(),
                                    updatedAt: new Date(),
                                },
                                create: {
                                    // Correction: Supprimé 'orderId: orderId,' car il est implicite lors de l'upsert imbriqué
                                    transactionId: transactionId,
                                    paymentMethod: method,
                                    amount: amount,
                                    currency: verificationResult.currency,
                                    status: status === 'SUCCESS' ? PaymentStatus.COMPLETED : PaymentStatus.FAILED,
                                    paymentDate: new Date(),
                                    createdAt: new Date(),
                                    updatedAt: new Date(),
                                }
                            }
                        }
                    },
                    include: {
                        payment: true // Inclure le paiement pour vérifier l'upsert
                    }
                });
                console.log(`[Kkiapay Callback] Commande ${updatedOrder.id} et paiement mis à jour. Nouveau statut de paiement: ${updatedOrder.paymentStatus}`);

                // Redirection finale vers la page de statut avec les bons paramètres
                return NextResponse.redirect(
                    new URL(`/order-status?orderId=${orderId}&status=${status === 'SUCCESS' ? 'success' : 'failed'}`, req.url),
                    307 // Utilisez 307 pour une redirection temporaire avec méthode GET
                );

            } catch (error) {
                console.error("[Kkiapay Callback] Erreur de traitement de la transaction ou de mise à jour de la DB:", error);
                // Si une erreur se produit après la validation de la signature, redirigez vers un statut d'échec
                return NextResponse.redirect(
                    new URL(`/order-status?orderId=${orderId}&status=failed&message=${encodeURIComponent('Erreur lors de la finalisation de la commande.')}`, req.url),
                    307
                );
            }
        }
    }

    // Si la signature est invalide ou manquante, redirigez vers un statut d'échec
    // C'est le cas par défaut si le bloc 'else' de la validation de signature est atteint
    return NextResponse.redirect(
        new URL(`/order-status?orderId=unknown&status=failed&message=${encodeURIComponent('Paiement non confirmé ou annulé.')}`, req.url),
        307
    );
}

export async function GET(request: NextRequest) {
    console.log("==> Kkiapay Callback GET reçu");

    const { searchParams } = new URL(request.url);

    // --- NOUVEAUX LOGS POUR DÉBOGAGE ---
    console.log("URL complète du callback:", request.url);
    console.log("Tous les paramètres de recherche reçus:");
    for (const [key, value] of searchParams.entries()) {
        console.log(`- ${key}: ${value}`);
    }
    // --- FIN NOUVEAUX LOGS ---

    // Votre ID de commande (celui que vous avez envoyé à Kkiapay via 'transactionId' dans la callback URL)
    const orderIdFromUrl = searchParams.get('transactionId'); 
    // L'ID de transaction réel de Kkiapay (peut être 'transaction_id' ou 'id' ou 'kkiapayActualTransactionId' si vous l'avez nommé ainsi)
    const kkiapayActualTransactionIdFromUrl = searchParams.get('transaction_id') || searchParams.get('id');

    // Déterminer l'ID de transaction Kkiapay à utiliser pour la vérification
    // Prioriser l'ID de transaction Kkiapay réel s'il est présent, sinon utiliser orderIdFromUrl
    const transactionIdToVerify = kkiapayActualTransactionIdFromUrl || orderIdFromUrl;
    
    // Pour la recherche de la commande dans votre DB, utilisez l'orderId que vous avez créé
    const orderIdForDbLookup = orderIdFromUrl;

    console.log("Paramètres de callback traités:", { 
        orderIdForDbLookup, 
        kkiapayActualTransactionIdFromUrl, 
        transactionIdToVerify 
    });

    if (!orderIdForDbLookup) {
        console.error("Callback Kkiapay: Votre ID de commande (transactionId) est manquant dans les paramètres du callback.");
        return NextResponse.redirect(`${request.nextUrl.origin}/order-status?status=error&message=${encodeURIComponent('Votre ID de commande est manquant dans le callback.')}`);
    }

    if (!transactionIdToVerify) {
        console.error("Callback Kkiapay: ID de transaction Kkiapay réel ou ID de commande pour vérification manquant dans les paramètres du callback.");
        return NextResponse.redirect(`${request.nextUrl.origin}/order-status?status=error&message=${encodeURIComponent('ID de transaction Kkiapay manquant pour la vérification.')}`);
    }

    let order: Awaited<ReturnType<typeof prisma.order.findUnique>> | null = null;

    try {
        // 1. Récupérer la commande dans votre base de données en utilisant l'orderId que vous avez généré
        order = await prisma.order.findUnique({
            where: { id: orderIdForDbLookup },
            include: { orderItems: true }
        });

        if (!order) {
            console.error(`Erreur critique: Commande ${orderIdForDbLookup} non trouvée dans la base de données lors du callback Kkiapay.`);
            return NextResponse.redirect(new URL(`/order-status?orderId=${orderIdForDbLookup}&status=failed&message=${encodeURIComponent('Commande introuvable pour la finalisation du paiement. Le paiement a peut-être échoué ou la commande n\'a pas été initiée correctement.')}`, request.url));
        }

        const nonNullableOrder = order as NonNullable<typeof order>; // Assertion de type pour aider TypeScript

        // 2. Vérifier la transaction auprès de l'API Kkiapay (étape cruciale de sécurité)
        let verification: VerificationResult;
        try {
            // Utiliser transactionIdToVerify pour la vérification Kkiapay
            verification = await verifyKkiapayTransaction(transactionIdToVerify);
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
                    where: { id: orderIdForDbLookup },
                    data: {
                        status: OrderStatus.PAYMENT_FAILED,
                        paymentStatus: PaymentStatus.FAILED,
                        updatedAt: new Date(),
                    },
                });
                await prisma.payment.update({
                    where: { orderId: orderIdForDbLookup },
                    data: {
                        status: PaymentStatus.FAILED,
                        updatedAt: new Date(),
                    }
                });
                console.log(`Commande ${orderIdForDbLookup} et paiement mis à jour en FAILED suite à l'échec de vérification.`);
            } catch (dbUpdateError) {
                console.error(`Erreur lors de la mise à jour de la commande/paiement en FAILED après échec de vérification:`, dbUpdateError);
            }

            return NextResponse.redirect(
                `${request.nextUrl.origin}/order-status?orderId=${orderIdForDbLookup}&status=failed&message=${encodeURIComponent(
                    'Erreur lors de la vérification du paiement Kkiapay: ' + (errorMessage || 'Erreur inconnue.')
                )}`
            );
        }

        const isSuccess = verification.status === 'SUCCESS' && verification.state === 'COMPLETED';
        const kkiapayTransactionAmount = verification.amount || 0;
        const kkiapayPaymentMethod = verification.paymentMethod || 'Mobile Money';
        const kkiapayVerifiedTransactionId = verification.transactionId || transactionIdToVerify; // Utilise l'ID vérifié ou celui envoyé

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
                where: { id: orderIdForDbLookup },
                data: {
                    status: finalOrderStatus,
                    paymentStatus: finalPaymentStatus,
                    updatedAt: new Date(),
                },
            });
            console.log(`Commande ${orderIdForDbLookup} mise à jour. Statut: ${finalOrderStatus}, Paiement: ${finalPaymentStatus}`);

            // Mettre à jour l'enregistrement de paiement (upsert pour être robuste)
            const paymentAmountDecimal = new Prisma.Decimal(kkiapayTransactionAmount);
            await prismaTx.payment.upsert({
                where: { orderId: orderIdForDbLookup },
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
                    // Correction: Ajout de la relation 'order' requise par PaymentCreateInput
                    order: { connect: { id: orderIdForDbLookup } },
                    transactionId: kkiapayVerifiedTransactionId, // Utilise l'ID vérifié
                    paymentMethod: kkiapayPaymentMethod,
                    amount: paymentAmountDecimal,
                    currency: verification.currency || nonNullableOrder.currency,
                    status: finalPaymentStatus,
                    paymentDate: new Date(),
                    createdAt: new Date(),
                    updatedAt: new Date(),
                }
            });
            console.log(`Paiement pour commande ${orderIdForDbLookup} mis à jour/créé.`);

            // Vider le panier de l'utilisateur si le paiement est réussi
            if (isSuccess && nonNullableOrder.userId) {
                await prismaTx.cartItem.deleteMany({
                    where: { userId: nonNullableOrder.userId },
                });
                console.log(`Panier de l'utilisateur ${nonNullableOrder.userId} vidé suite au succès du paiement.`);
            }
        });

        const redirectUrl = isSuccess
            ? `${request.nextUrl.origin}/order-status?orderId=${orderIdForDbLookup}&status=success`
            : `${request.nextUrl.origin}/order-status?orderId=${orderIdForDbLookup}&status=failed&message=${encodeURIComponent(redirectMessage)}`;

        return NextResponse.redirect(redirectUrl);

    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error("Erreur générale lors du traitement du callback Kkiapay:", errorMessage);

        return NextResponse.redirect(
            `${request.nextUrl.origin}/order-status?orderId=${orderIdForDbLookup || 'unknown'}&status=failed&message=${encodeURIComponent('Erreur serveur interne lors du traitement du paiement: ' + errorMessage)}`
        );
    }
}
