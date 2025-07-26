// lib/kkiapay.ts
import axios from 'axios';

const KKIAPAY_PRIVATE_API_KEY = process.env.KKIAPAY_PRIVATE_API_KEY;
const KKIAPAY_SECRET = process.env.KKIAPAY_SECRET;
const KKIAPAY_PUBLIC_API_KEY = process.env.NEXT_PUBLIC_KKIAPAY_PUBLIC_API_KEY;

interface KkiapayVerificationResponse {
    status: string;
    amount?: number;
    paymentMethod?: string;
    transactionId?: string;
    message?: string;
    currency?: string;
    state?: string;
    reason?: { code?: string; message?: string };
    // Ajoutez d'autres champs que Kkiapay pourrait retourner
}

export async function verifyKkiapayTransaction(transactionId: string): Promise<KkiapayVerificationResponse> {
    if (!KKIAPAY_PRIVATE_API_KEY || !KKIAPAY_SECRET || !KKIAPAY_PUBLIC_API_KEY) {
        console.error("Missing Kkiapay API keys in environment variables.");
        throw new Error("Kkiapay API keys are not configured on the server.");
    }

    try {
        const response = await axios.post<KkiapayVerificationResponse>(
            'https://api.kkiapay.me/v1/transactions/verify',
            { transactionId: transactionId },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': KKIAPAY_PRIVATE_API_KEY,
                    'x-secret-key': KKIAPAY_SECRET,
                    'x-public-key': KKIAPAY_PUBLIC_API_KEY,
                },
            }
        );
        return response.data;
    } catch (error: unknown) {
        console.error(`Error verifying Kkiapay transaction ${transactionId}:`, error);
        if (axios.isAxiosError(error) && error.response) {
            throw new Error(`Kkiapay verification failed: ${error.response.data.message || 'Unknown error'}`);
        } else if (error instanceof Error) {
            throw error;
        } else {
            throw new Error('An unexpected error occurred during Kkiapay verification.');
        }
    }
}
