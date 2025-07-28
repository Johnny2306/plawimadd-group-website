// lib/kkiapay.ts

// Make sure these environment variables are defined on Vercel
// and contain the REAL Kkiapay keys for your account (secret, private_api_key, and public_api_key)

const KKIAPAY_SECRET = process.env.KKIAPAY_SECRET!;
const KKIAPAY_PRIVATE_API_KEY = process.env.KKIAPAY_PRIVATE_API_KEY!;
const KKIAPAY_PUBLIC_API_KEY = process.env.NEXT_PUBLIC_KKIAPAY_PUBLIC_API_KEY!;

// Type definition for Kkiapay verification result
interface VerificationResult {
  status: string;
  amount: number;
  paymentMethod: string;
  transactionId: string;
  currency: string;
  state: string;
  reason?: { code?: string; message?: string };
  message?: string; // Added for generic error messages
}

/**
 * Kkiapay side verification via their API (POST /v1/transactions/verify)
 * @param transactionId The Kkiapay transaction ID to verify.
 * @returns A VerificationResult object containing transaction details.
 * @throws Error if verification fails or Kkiapay API returns an error.
 */
async function verifyKkiapayTransaction(transactionId: string): Promise<VerificationResult> {
  try {
    // Force Kkiapay API URL to Live mode, as requested by the user.
    // Ensure your environment variables (KKIAPAY_SECRET, KKIAPAY_PRIVATE_API_KEY, NEXT_PUBLIC_KKIAPAY_PUBLIC_API_KEY)
    // are set with your LIVE Kkiapay keys.
    const baseUrl = 'https://api.kkiapay.me'; // Always use Live API URL
    const url = `${baseUrl}/v1/transactions/verify`;

    console.log(`[KKIAPAY] Verifying transaction on URL: ${url}`);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-secret-key': KKIAPAY_SECRET,
        'x-public-key': KKIAPAY_PUBLIC_API_KEY,
        'x-api-key': KKIAPAY_PRIVATE_API_KEY,
      },
      body: JSON.stringify({ transactionId }),
    });

    if (!response.ok) {
      // Log the response body in case of error for better debugging
      const errorText = await response.text();
      console.error(`[KKIAPAY] HTTP Error ${response.status}: ${errorText}`);
      // If status is 404, it may indicate incorrect authentication or transaction not found in the environment.
      if (response.status === 404) {
          throw new Error(`Transaction ${transactionId} not found or incorrect API keys (HTTP 404).`);
      }
      throw new Error(`Kkiapay API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();

    return {
      status: data.status,
      amount: Number(data.amount),
      paymentMethod: data.paymentMethod,
      transactionId: data.transactionId,
      currency: data.currency,
      state: data.state,
      reason: data.reason,
      message: data.message, // Include generic message if present
    };
  } catch (error) {
    console.error('[KKIAPAY] API verification error:', error);
    // Re-throw the error so it can be caught higher up in `kkiapay-callback/route.ts`
    throw error; 
  }
}

// Correction: Use 'export type' for types when 'isolatedModules' is enabled
export { verifyKkiapayTransaction };
export type { VerificationResult }; 
