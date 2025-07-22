// app/api/order/prepare-payment/route.ts
import { NextResponse, NextRequest } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';
import { authorizeLoggedInUser, AuthResult } from '@/lib/authUtils';

export async function GET(req: NextRequest): Promise<NextResponse> {
  const authResult: AuthResult = await authorizeLoggedInUser(req);
  if (!authResult.authorized) {
    return authResult.response!;
  }

  try {
    // Générer un ID de transaction unique
    const transactionId = uuidv4();

    // Préparation (facultative) : Appel à l’API Kkiapay (à adapter selon besoin réel)
    // const response = await axios.post(
    //   'https://api.kkiapay.me/api/v1/transaction/initiate',
    //   {
    //     transactionId,
    //     amount: 1000, // Exemple de montant
    //     currency: 'XOF',
    //     phone: '22997000000', // Exemple
    //     email: 'test@example.com',
    //     reason: 'Achat de produit',
    //   },
    //   {
    //     headers: {
    //       Authorization: `Bearer ${process.env.KKIAPAY_SECRET_KEY}`,
    //       'Content-Type': 'application/json',
    //     },
    //   }
    // );

    console.log(`Transaction ID généré: ${transactionId}`);

    return NextResponse.json(
      {
        success: true,
        message: 'Transaction ID généré avec succès',
        transactionId,
        // kkiapayResponse: response.data // (optionnel)
      },
      { status: 200 }
    );
  } catch (_error: unknown) {
    console.error('Erreur lors de la génération ou appel Kkiapay :', _error);
    const errorMessage = _error instanceof Error ? _error.message : String(_error);
    return NextResponse.json(
      {
        success: false,
        message: `Erreur lors de la préparation du paiement : ${errorMessage}`,
      },
      { status: 500 }
    );
  }
}
