// C:\xampp\htdocs\plawimadd_group\app\api\kkiapay-webhook\route.ts
// Ce webhook reçoit les notifications de transaction de Kkiapay et met à jour l'état des commandes et paiements.

import { NextResponse, NextRequest } from 'next/server';
import crypto from 'crypto';
// Add Prisma to the import for Prisma.Decimal
import prisma from '@/lib/prisma';
import { OrderStatus, PaymentStatus, Prisma } from '@prisma/client'; // Importez les enums de Prisma ET Prisma

// IMPORTANT: Utiliser le nom de variable d'environnement correct : KKIAPAY_SECRET
const KAKAPAY_WEBHOOK_SECRET = process.env.KKIAPAY_SECRET;

/**
 * Valide la signature du webhook Kkiapay.
 * @param rawBody Le corps brut de la requête.
 * @param signatureHeader L'en-tête 'X-Kkiapay-Signature'.
 * @param secret Le secret de webhook Kkiapay.
 * @returns true si la signature est valide, false sinon.
 */
function isValidKakapayWebhookSignature(
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

interface KakapayEventData {
    id: string; // Transaction ID Kkiapay
    reference?: string; // Order ID interne (string car l'ID de commande est un UUID)
    status: 'SUCCESS' | 'FAILED' | 'CANCELLED' | 'PENDING' | string; // Statut transaction Kkiapay
    amount: number;
    currency?: string;
    paymentMethod?: string;
}

interface KakapayWebhookEvent {
    event_type: string;
    data: KakapayEventData;
}

export async function POST(req: NextRequest) {
    let rawBody: string;

    try {
        rawBody = await req.text(); // Lire le corps brut de la requête
        const event: KakapayWebhookEvent = JSON.parse(rawBody);
        const signature = req.headers.get('X-Kkiapay-Signature');

        // Validation de la signature du webhook
        if (!isValidKakapayWebhookSignature(rawBody, signature, KAKAPAY_WEBHOOK_SECRET)) {
            return NextResponse.json({ message: 'Signature de webhook invalide' }, { status: 401 });
        }

        console.log('--- Webhook Kkiapay reçu ---');
        console.log('Event type:', event.event_type);
        console.log('Event data:', event.data);
        console.log('---------------------------');

        const {
            id: kakapayTransactionId,
            reference: orderReference, // Ceci est l'ID de la commande dans votre DB
            status: paymentStatusFromKakapay,
            amount,
            currency = 'XOF',
            paymentMethod = 'Inconnu'
        } = event.data;

        let newOrderStatus: OrderStatus; // Utilisation de l'enum Prisma
        let newPaymentStatus: PaymentStatus; // Utilisation de l'enum Prisma

        // Mappage des statuts Kkiapay vers les enums Prisma
        switch (paymentStatusFromKakapay) {
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
                console.warn(`Statut Kkiapay inattendu (${paymentStatusFromKakapay}), traité comme échec.`);
        }

        // Début de la transaction Prisma
        await prisma.$transaction(async (prismaTx) => {
            let orderIdToUpdate: string | null = null;

            // 1. Chercher la commande par kakapayTransactionId
            const orderFoundByKkiapayId = await prismaTx.order.findFirst({
                where: { kakapayTransactionId: kakapayTransactionId },
                select: { id: true },
            });

            if (orderFoundByKkiapayId) {
                orderIdToUpdate = orderFoundByKkiapayId.id;
            } else if (orderReference) {
                // 2. Si non trouvée, chercher par orderReference (qui est l'ID de commande interne)
                // L'ID de commande (reference) doit être un UUID valide pour un findUnique
                // Si Kkiapay envoie parfois une référence qui n'est pas un UUID (ex: un ID numérique simple),
                // vous devrez adapter cette logique ou vous assurer que votre référence envoyée à Kkiapay est toujours l'UUID de votre commande.
                const orderFoundByReference = await prismaTx.order.findUnique({
                    where: { id: orderReference }, // id est @unique dans schema.prisma
                    select: { id: true },
                });
                if (orderFoundByReference) {
                    orderIdToUpdate = orderFoundByReference.id;
                }
            }

            if (!orderIdToUpdate) {
                console.warn(`Commande non trouvée pour transaction Kkiapay ID: ${kakapayTransactionId} ou référence: ${orderReference}.`);
                // Nous lançons une erreur pour provoquer un rollback si la commande n'est pas trouvée.
                // Cela est important pour ne pas laisser de transaction de paiement orpheline.
                throw new Error('Commande non trouvée pour mise à jour du statut de paiement.');
            }

            // 3. Mise à jour de la commande
            const updatedOrder = await prismaTx.order.update({
                where: { id: orderIdToUpdate }, // Utiliser l'ID de commande trouvé
                data: {
                    status: newOrderStatus,
                    paymentStatus: newPaymentStatus,
                    kakapayTransactionId: kakapayTransactionId, // S'assurer que l'ID Kkiapay est bien enregistré
                    updatedAt: new Date(), // Mettre à jour la date de modification
                },
            });
            console.log(`Commande ${updatedOrder.id} mise à jour. Nouveau statut: ${newOrderStatus}, Statut paiement: ${newPaymentStatus}`);


            // 4. Insert ou update du paiement
            // Utiliser upsert pour créer le paiement s'il n'existe pas, ou le mettre à jour s'il existe.
            // La contrainte unique sur orderId dans le modèle Payment permet cela.
            // CORRECTION ICI: Utiliser Prisma.Decimal
            const paymentAmountDecimal = new Prisma.Decimal(amount); // Assurez-vous que le montant est un Decimal

            const upsertedPayment = await prismaTx.payment.upsert({
                where: { orderId: orderIdToUpdate }, // Chercher par orderId qui est unique dans Payment
                update: {
                    paymentMethod: paymentMethod,
                    transactionId: kakapayTransactionId,
                    amount: paymentAmountDecimal,
                    currency: currency,
                    status: newPaymentStatus,
                    paymentDate: new Date(), // Date du paiement
                    updatedAt: new Date(),
                },
                create: {
                    orderId: orderIdToUpdate,
                    paymentMethod: paymentMethod,
                    transactionId: kakapayTransactionId,
                    amount: paymentAmountDecimal,
                    currency: currency,
                    status: newPaymentStatus,
                    paymentDate: new Date(),
                    createdAt: new Date(),
                    updatedAt: new Date(),
                },
            });
            console.log(`Paiement pour commande ${orderIdToUpdate} upserté. ID transaction Kkiapay: ${upsertedPayment.transactionId}`);
        }); // Fin de la transaction Prisma

        console.log('Webhook Kkiapay traité avec succès et transaction DB committée.');
        return NextResponse.json({ message: 'Webhook Kkiapay traité avec succès' }, { status: 200 });

    } catch (_error: unknown) {
        const message = _error instanceof Error ? _error.message : String(_error);
        console.error('Erreur lors du traitement du webhook Kkiapay:', _error);

        // Gérer les erreurs spécifiques de Prisma si nécessaire, ex: P2025 (record not found for update/delete)
        if (
            typeof _error === 'object' &&
            _error !== null &&
            'code' in _error &&
            (_error as { code?: string }).code === 'P2025'
        ) {
            return NextResponse.json({ message: 'Erreur: Commande ou paiement non trouvé pour mise à jour.' }, { status: 404 });
        }

        return NextResponse.json({ message: `Erreur interne lors du traitement du webhook: ${message}` }, { status: 500 });
    }
}