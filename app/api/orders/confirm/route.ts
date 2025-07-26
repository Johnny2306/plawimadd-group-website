// app/api/orders/confirm/route.ts
// Ce webhook reçoit les notifications de transaction de Kkiapay et met à jour l'état des commandes et paiements.

import { NextResponse, NextRequest } from 'next/server';
import crypto from 'crypto';
import prisma from '@/lib/prisma';
import { OrderStatus, PaymentStatus, Prisma } from '@prisma/client'; // Importez les enums de Prisma ET Prisma

// IMPORTANT: Utiliser le nom de variable d'environnement correct : KKIAPAY_SECRET
const KKIAPAY_WEBHOOK_SECRET = process.env.KKIAPAY_SECRET; // Correction: KKIAPAY_SECRET

/**
 * Valide la signature du webhook Kkiapay.
 * @param rawBody Le corps brut de la requête.
 * @param signatureHeader L'en-tête 'X-Kkiapay-Signature'.
 * @param secret Le secret de webhook Kkiapay.
 * @returns true si la signature est valide, false sinon.
 */
function isValidKkiapayWebhookSignature(
    rawBody: string,
    signatureHeader: string | null,
    secret: string | undefined
): boolean {
    if (!secret) {
        console.error('KKIAPAY_SECRET non configuré dans les variables d\'environnement.');
        return false;
    }
    if (!signatureHeader) {
        console.warn('Webhook reçu sans en-tête X-Kkiapay-Signature. Rejeté.');
        return false;
    }
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(rawBody);
    const digest = hmac.digest('hex');
    const isVerified = digest === signatureHeader;
    if (!isVerified) {
        console.error(`Signature invalide: reçue ${signatureHeader}, calculée ${digest}`);
    }
    return isVerified;
}

interface KkiapayEventData {
    id: string; // Transaction ID Kkiapay
    reference?: string; // Order ID interne (string car l'ID de commande est un UUID)
    status: 'SUCCESS' | 'FAILED' | 'CANCELLED' | 'PENDING' | string; // Statut transaction Kkiapay
    amount: number;
    currency?: string;
    paymentMethod?: string;
}

interface KkiapayWebhookEvent {
    event_type: string;
    data: KkiapayEventData;
}

export async function POST(req: NextRequest) {
    let rawBody: string;

    try {
        rawBody = await req.text(); // Lire le corps brut de la requête
        const event: KkiapayWebhookEvent = JSON.parse(rawBody);
        const signature = req.headers.get('X-Kkiapay-Signature');

        // Validation de la signature du webhook
        if (!isValidKkiapayWebhookSignature(rawBody, signature, KKIAPAY_WEBHOOK_SECRET)) {
            return NextResponse.json({ message: 'Signature de webhook invalide' }, { status: 401 });
        }

        console.log('--- Webhook Kkiapay reçu ---');
        console.log('Event type:', event.event_type);
        console.log('Event data:', event.data);
        console.log('---------------------------');

        const {
            id: kkiapayTransactionId, // Kkiapay transaction ID
            reference: orderReference, // This is your internal order ID if you passed it to Kkiapay's reference field
            status: paymentStatusFromKkiapay,
            amount,
            currency = 'XOF',
            paymentMethod = 'Inconnu'
        } = event.data;

        let newOrderStatus: OrderStatus;
        let newPaymentStatus: PaymentStatus;

        // Mappage des statuts Kkiapay vers les enums Prisma
        switch (paymentStatusFromKkiapay) {
            case 'SUCCESS':
                newOrderStatus = OrderStatus.PAID_SUCCESS;
                newPaymentStatus = PaymentStatus.COMPLETED;
                break;
            case 'FAILED':
            case 'CANCELLED':
                newOrderStatus = OrderStatus.PAYMENT_FAILED;
                newPaymentStatus = PaymentStatus.FAILED;
                break;
            case 'PENDING':
                newOrderStatus = OrderStatus.PENDING;
                newPaymentStatus = PaymentStatus.PENDING;
                break;
            default:
                newOrderStatus = OrderStatus.PAYMENT_FAILED;
                newPaymentStatus = PaymentStatus.FAILED;
                console.warn(`Statut Kkiapay inattendu (${paymentStatusFromKkiapay}), traité comme échec.`);
        }

        // Début de la transaction Prisma
        await prisma.$transaction(async (prismaTx) => {
            let orderToUpdateId: string | null = null;

            // Tenter de trouver la commande par l'ID de transaction Kkiapay (qui est maintenant Order.id)
            // Ou par la référence si Kkiapay l'a envoyée et qu'elle correspond à un Order.id
            if (kkiapayTransactionId) {
                const orderFoundById = await prismaTx.order.findUnique({
                    where: { id: kkiapayTransactionId },
                    select: { id: true },
                });
                if (orderFoundById) {
                    orderToUpdateId = orderFoundById.id;
                }
            }

            // Si non trouvée par kkiapayTransactionId, et si une référence est fournie, tenter par la référence
            if (!orderToUpdateId && orderReference) {
                const orderFoundByReference = await prismaTx.order.findUnique({
                    where: { id: orderReference },
                    select: { id: true },
                });
                if (orderFoundByReference) {
                    orderToUpdateId = orderFoundByReference.id;
                }
            }

            if (!orderToUpdateId) {
                console.warn(`Commande non trouvée pour transaction Kkiapay ID: ${kkiapayTransactionId} ou référence: ${orderReference}.`);
                throw new Error('Commande non trouvée pour mise à jour du statut de paiement.');
            }

            // Mise à jour de la commande
            const updatedOrder = await prismaTx.order.update({
                where: { id: orderToUpdateId },
                data: {
                    status: newOrderStatus,
                    paymentStatus: newPaymentStatus,
                    // kkiapayTransactionId n'existe plus, l'ID de la commande est le transactionId Kkiapay
                    updatedAt: new Date(),
                },
            });
            console.log(`Commande ${updatedOrder.id} mise à jour. Nouveau statut: ${newOrderStatus}, Statut paiement: ${newPaymentStatus}`);

            // Insert ou update du paiement
            const paymentAmountDecimal = new Prisma.Decimal(amount);

            const upsertedPayment = await prismaTx.payment.upsert({
                where: { orderId: orderToUpdateId },
                update: {
                    paymentMethod: paymentMethod,
                    transactionId: kkiapayTransactionId, // L'ID de transaction Kkiapay est stocké ici
                    amount: paymentAmountDecimal,
                    currency: currency,
                    status: newPaymentStatus,
                    paymentDate: new Date(),
                    updatedAt: new Date(),
                },
                create: {
                    orderId: orderToUpdateId,
                    paymentMethod: paymentMethod,
                    transactionId: kkiapayTransactionId, // L'ID de transaction Kkiapay est stocké ici
                    amount: paymentAmountDecimal,
                    currency: currency,
                    status: newPaymentStatus,
                    paymentDate: new Date(),
                    createdAt: new Date(),
                    updatedAt: new Date(),
                },
            });
            console.log(`Paiement pour commande ${orderToUpdateId} upserté. ID transaction Kkiapay: ${upsertedPayment.transactionId}`);

            // Vider le panier de l'utilisateur si le paiement est réussi
            if (newPaymentStatus === PaymentStatus.COMPLETED && updatedOrder.userId) {
                await prismaTx.cartItem.deleteMany({
                    where: { userId: updatedOrder.userId },
                });
                console.log(`Panier de l'utilisateur ${updatedOrder.userId} vidé suite au succès du paiement.`);
            }
        });

        console.log('Webhook Kkiapay traité avec succès et transaction DB committée.');
        return NextResponse.json({ message: 'Webhook Kkiapay traité avec succès' }, { status: 200 });

    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        console.error('Erreur lors du traitement du webhook Kkiapay:', error);

        if (
            typeof error === 'object' &&
            error !== null &&
            'code' in error &&
            (error as { code?: string }).code === 'P2025'
        ) {
            return NextResponse.json({ message: 'Erreur: Commande ou paiement non trouvé pour mise à jour.' }, { status: 404 });
        }

        return NextResponse.json({ message: `Erreur interne lors du traitement du webhook: ${message}` }, { status: 500 });
    }
}
