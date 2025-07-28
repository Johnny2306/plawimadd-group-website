// app/api/orders/confirm/route.ts
// Cette route n'est pas utilisée pour les webhooks Kkiapay.
// Toute logique de webhook Kkiapay doit être gérée dans app/api/kkiapay-callback/route.ts.

import { NextResponse } from 'next/server';

/**
 * Gère toutes les requêtes (GET, POST, etc.) pour cette route.
 * Renvoie une erreur "Method Not Allowed" car cette route n'est pas destinée à être utilisée.
 */
export async function GET() {
  return NextResponse.json({ message: 'Method Not Allowed' }, { status: 405 });
}

export async function POST() {
  return NextResponse.json({ message: 'Method Not Allowed' }, { status: 405 });
}

export async function PUT() {
  return NextResponse.json({ message: 'Method Not Allowed' }, { status: 405 });
}

export async function DELETE() {
  return NextResponse.json({ message: 'Method Not Allowed' }, { status: 405 });
}

// Vous pouvez ajouter d'autres méthodes HTTP (PATCH, HEAD, OPTIONS) si nécessaire,
// toutes renvoyant un statut 405.
