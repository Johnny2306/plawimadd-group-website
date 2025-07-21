// C:\xampp\htdocs\plawimadd_group\app\api\categories/[id]/route.ts
// Cette route gère les opérations CRUD (Get, Put, Delete) pour une catégorie spécifique par son ID.

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { authorizeAdminRequest, AuthResult } from '@/lib/authUtils';

interface Context {
    params: {
        id: string;
    };
}

// GET: Récupérer une catégorie par son ID
export async function GET(req: NextRequest, context: Context): Promise<NextResponse> {
    const { id } = context.params;

    try {
        if (!id || typeof id !== 'string') {
            return NextResponse.json({ message: 'ID de catégorie valide (chaîne) manquant.' }, { status: 400 });
        }

        const category = await prisma.category.findUnique({
            where: { id: id },
        });

        if (!category) {
            return NextResponse.json({ message: 'Catégorie non trouvée.' }, { status: 404 });
        }

        return NextResponse.json(category, { status: 200 });
    } catch (_error: unknown) {
        const message = _error instanceof Error ? _error.message : String(_error);
        console.error('Erreur lors de la récupération de la catégorie:', _error);
        return NextResponse.json({ message: 'Erreur interne du serveur lors de la récupération de la catégorie.', error: message }, { status: 500 });
    }
}

// PUT: Mettre à jour une catégorie par son ID (Requiert le rôle ADMIN)
export async function PUT(req: NextRequest, context: Context): Promise<NextResponse> {
    const authResult: AuthResult = await authorizeAdminRequest(req); // MODIFICATION : Passe 'req'
    if (!authResult.authorized) return authResult.response!;

    const { id } = context.params;

    try {
        const { name, description, imageUrl } = await req.json();

        if (!name || typeof name !== 'string' || name.trim() === '') {
            return NextResponse.json({ message: 'Le nom de la catégorie (chaîne non vide) est requis pour la mise à jour.' }, { status: 400 });
        }
        if (description !== undefined && typeof description !== 'string' && description !== null) {
            return NextResponse.json({ message: 'La description doit être une chaîne ou null.' }, { status: 400 });
        }
        if (imageUrl !== undefined && typeof imageUrl !== 'string' && imageUrl !== null) {
            return NextResponse.json({ message: 'L\'URL de l\'image doit être une chaîne ou null.' }, { status: 400 });
        }
        if (!id || typeof id !== 'string') {
            return NextResponse.json({ message: 'ID de catégorie valide (chaîne) manquant pour la mise à jour.' }, { status: 400 });
        }

        const updatedCategory = await prisma.category.update({
            where: { id: id },
            data: {
                name: name.trim(),
                description: description || null,
                imageUrl: imageUrl || null,
                updatedAt: new Date(),
            },
        });

        return NextResponse.json({ message: 'Catégorie mise à jour avec succès.', category: updatedCategory }, { status: 200 });
    } catch (_error: unknown) {
        const message = _error instanceof Error ? _error.message : String(_error);

        if (
            typeof _error === 'object' &&
            _error !== null &&
            'code' in _error &&
            (_error as { code?: string }).code === 'P2025'
        ) {
            return NextResponse.json({ message: 'Catégorie non trouvée ou aucune modification effectuée.' }, { status: 404 });
        }

        console.error('Erreur lors de la mise à jour de la catégorie:', _error);
        return NextResponse.json({ message: 'Erreur interne du serveur lors de la mise à jour de la catégorie.', error: message }, { status: 500 });
    }
}

// DELETE: Supprimer une catégorie par son ID (Requiert le rôle ADMIN)
export async function DELETE(req: NextRequest, context: Context): Promise<NextResponse> {
    const authResult: AuthResult = await authorizeAdminRequest(req); // MODIFICATION : Passe 'req'
    if (!authResult.authorized) return authResult.response!;

    const { id } = context.params;

    try {
        if (!id || typeof id !== 'string') {
            return NextResponse.json({ message: 'ID de catégorie valide (chaîne) manquant pour la suppression.' }, { status: 400 });
        }

        const deletedCategory = await prisma.category.delete({
            where: { id: id },
        });

        return NextResponse.json({ message: 'Catégorie supprimée avec succès.', category: deletedCategory }, { status: 200 });
    } catch (_error: unknown) {
        const message = _error instanceof Error ? _error.message : String(_error);
        console.error('Erreur lors de la suppression de la catégorie:', _error);

        if (
            typeof _error === 'object' &&
            _error !== null &&
            'code' in _error &&
            (_error as { code?: string }).code === 'P2025'
        ) {
            return NextResponse.json({ message: 'Catégorie non trouvée ou déjà supprimée.' }, { status: 404 });
        }

        if (
            typeof _error === 'object' &&
            _error !== null &&
            'code' in _error &&
            (_error as { code?: string }).code === 'P2003'
        ) {
            return NextResponse.json({
                message: "Impossible de supprimer la catégorie car elle est liée à d'autres entités (ex: produits). Supprimez d'abord les produits associés ou configurez la suppression en cascade dans votre schéma Prisma."
            }, { status: 409 });
        }

        return NextResponse.json({ message: 'Erreur interne du serveur lors de la suppression de la catégorie.', error: message }, { status: 500 });
    }
}