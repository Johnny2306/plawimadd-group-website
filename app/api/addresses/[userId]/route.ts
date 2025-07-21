
// C:\xampp\htdocs\plawimadd_group\app\api\addresses\[userId]\route.ts

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { Address } from '@/lib/types'; // Assurez-vous que l'interface Address ici correspond à lib/types.ts
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';

// IMPORTATION DES FONCTIONS ET INTERFACES D'AUTHUTILS
import { authorizeUser, AuthResult } from '@/lib/authUtils';
import { Context as AuthContext } from '@/lib/authUtils';


interface RouteContext extends AuthContext {
    params: {
        userId: string;
    };
}


/**
 * GET /api/addresses/[userId]
 * Récupère toutes les adresses d'un utilisateur spécifique.
 * Nécessite une authentification et une autorisation (utilisateur ou admin).
 */
export async function GET(req: NextRequest, context: RouteContext): Promise<NextResponse> {
    const authResult: AuthResult = await authorizeUser(req, context as AuthContext);
    if (!authResult.authorized) {
        return authResult.response!;
    }
    const userId = authResult.userId!;

    try {
        const addresses = await prisma.address.findMany({
            where: { userId: userId },
            orderBy: { createdAt: 'desc' },
        });
        return NextResponse.json({ success: true, addresses }, { status: 200 });
    } catch (_error: unknown) {
        console.error("Erreur lors de la récupération des adresses:", _error);
        const errorMessage = _error instanceof Error ? _error.message : String(_error);
        return NextResponse.json({ success: false, message: "Erreur serveur lors de la récupération des adresses.", error: errorMessage }, { status: 500 });
    }
}

/**
 * POST /api/addresses/[userId]
 * Ajoute une nouvelle adresse pour un utilisateur spécifique.
 * Nécessite une authentification et une autorisation.
 */
export async function POST(req: NextRequest, context: RouteContext): Promise<NextResponse> {
    const authResult: AuthResult = await authorizeUser(req, context as AuthContext);
    if (!authResult.authorized) {
        return authResult.response!;
    }
    const userId = authResult.userId!;

    try {
        // Destructuration avec isDefault par défaut à false si non fourni
        const { fullName, phoneNumber, pincode, area, city, state, isDefault = false, street, country }: Address = await req.json();

        // CORRECTION: pincode n'est plus obligatoire dans la validation
        if (!fullName || !phoneNumber || !area || !city || !state) {
            return NextResponse.json({ success: false, message: 'Les champs obligatoires de l\'adresse (fullName, phoneNumber, area, city, state) sont requis.' }, { status: 400 });
        }

        // Logique pour gérer l'adresse par défaut
        if (isDefault) {
            // Si la nouvelle adresse est définie comme par défaut,
            // marquer toutes les autres adresses de cet utilisateur comme non par défaut.
            await prisma.address.updateMany({
                where: {
                    userId: userId,
                    isDefault: true, // Cible les adresses actuellement par défaut
                },
                data: {
                    isDefault: false,
                },
            });
        }

        const newAddress = await prisma.address.create({
            data: {
                userId,
                fullName,
                phoneNumber,
                pincode: pincode || null, // Assure que pincode est null si vide/undefined
                area,
                city,
                state,
                isDefault,
                street: street || null,
                country: country || 'Unknown',
            },
        });
        return NextResponse.json({ success: true, message: 'Adresse ajoutée avec succès.', addressId: String(newAddress.id) }, { status: 201 });
    } catch (_error: unknown) {
        console.error("Erreur lors de l'ajout de l'adresse:", _error);
        const errorMessage = _error instanceof Error ? _error.message : String(_error);
        return NextResponse.json({ success: false, message: "Erreur serveur lors de l'ajout de l'adresse.", error: errorMessage }, { status: 500 });
    }
}

/**
 * PUT /api/addresses/[userId]
 * Met à jour une adresse existante pour un utilisateur spécifique.
 * Nécessite une authentification et une autorisation.
 */
export async function PUT(req: NextRequest, context: RouteContext): Promise<NextResponse> {
    const authResult: AuthResult = await authorizeUser(req, context as AuthContext);
    if (!authResult.authorized) {
        return authResult.response!;
    }
    const userId = authResult.userId!;

    try {
        const { id, fullName, phoneNumber, pincode, area, city, state, isDefault, street, country }: Address = await req.json();

        // CORRECTION: pincode n'est plus obligatoire dans la validation
        if (!id || !fullName || !phoneNumber || !area || !city || !state) {
            return NextResponse.json({ success: false, message: 'ID et les champs obligatoires de l\'adresse (fullName, phoneNumber, area, city, state) sont requis pour la mise à jour.' }, { status: 400 });
        }

        const addressIdAsNumber = parseInt(id, 10);
        if (isNaN(addressIdAsNumber)) {
            return NextResponse.json({ success: false, message: 'ID d\'adresse invalide.' }, { status: 400 });
        }

        // Logique pour gérer l'adresse par défaut lors de la mise à jour
        if (isDefault) {
            // Si cette adresse est définie comme par défaut,
            // marquer toutes les autres adresses de cet utilisateur comme non par défaut.
            await prisma.address.updateMany({
                where: {
                    userId: userId,
                    isDefault: true,
                    NOT: { id: addressIdAsNumber }, // Exclure l'adresse que nous sommes en train de mettre à jour
                },
                data: {
                    isDefault: false,
                },
            });
        }

        const updatedAddress = await prisma.address.updateMany({
            where: {
                id: addressIdAsNumber,
                userId: userId, // S'assurer que l'utilisateur est bien le propriétaire de l'adresse
            },
            data: {
                fullName,
                phoneNumber,
                pincode: pincode || null, // Assure que pincode est null si vide/undefined
                area,
                city,
                state,
                isDefault,
                street: street || null,
                country: country || 'Unknown',
            },
        });

        if (updatedAddress.count === 0) {
            return NextResponse.json({ success: false, message: 'Adresse non trouvée ou non autorisée pour la mise à jour.' }, { status: 404 });
        }
        return NextResponse.json({ success: true, message: 'Adresse mise à jour avec succès.' }, { status: 200 });
    } catch (_error: unknown) {
        console.error("Erreur lors de la mise à jour de l'adresse:", _error);
        const errorMessage = _error instanceof Error ? _error.message : String(_error);
        if (_error instanceof PrismaClientKnownRequestError && _error.code === 'P2025') {
            return NextResponse.json({ success: false, message: "Adresse non trouvée ou non associée à l'utilisateur." }, { status: 404 });
        }
        return NextResponse.json({ success: false, message: "Erreur serveur lors de la mise à jour de l'adresse.", error: errorMessage }, { status: 500 });
    }
}

/**
 * DELETE /api/addresses/[userId]
 * Supprime une adresse spécifique de l'utilisateur.
 * Nécessite une authentification et une autorisation.
 */
export async function DELETE(req: NextRequest, context: RouteContext): Promise<NextResponse> {
    const authResult: AuthResult = await authorizeUser(req, context as AuthContext);
    if (!authResult.authorized) {
        return authResult.response!;
    }
    const userId = authResult.userId!;

    try {
        const { addressId } = await req.json();

        if (!addressId) {
            return NextResponse.json({ success: false, message: 'ID de l\'adresse est requis pour la suppression.' }, { status: 400 });
        }

        const addressIdAsNumber = parseInt(addressId, 10);
        if (isNaN(addressIdAsNumber)) {
            return NextResponse.json({ success: false, message: 'ID d\'adresse invalide.' }, { status: 400 });
        }

        const result = await prisma.address.deleteMany({
            where: {
                id: addressIdAsNumber,
                userId: userId,
            },
        });

        if (result.count === 0) {
            return NextResponse.json({ success: false, message: 'Adresse non trouvée ou non autorisée.' }, { status: 404 });
        }
        return NextResponse.json({ success: true, message: 'Adresse supprimée avec succès.' }, { status: 200 });
    } catch (_error: unknown) {
        console.error("Erreur lors de la suppression de l'adresse:", _error);
        const errorMessage = _error instanceof Error ? _error.message : String(_error);
        if (_error instanceof PrismaClientKnownRequestError && _error.code === 'P2025') {
            return NextResponse.json({ success: false, message: "Adresse non trouvée ou non associée à l'utilisateur." }, { status: 404 });
        }
        return NextResponse.json({ success: false, message: "Erreur serveur lors de la suppression de l'adresse.", error: errorMessage }, { status: 500 });
    }
}
