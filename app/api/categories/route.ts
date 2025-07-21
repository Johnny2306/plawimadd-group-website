// C:\xampp\htdocs\plawimadd_group\app\api\categories\route.ts
// Cette route gère la récupération de toutes les catégories et la création de nouvelles catégories.

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { authorizeAdminRequest, AuthResult } from '@/lib/authUtils';

// GET: Récupérer toutes les catégories (Accessible publiquement)
export async function GET(): Promise<NextResponse> { // Pas de 'req' nécessaire ici, donc pas de modification de signature
    try {
        const categories = await prisma.category.findMany({
            orderBy: { name: 'asc' },
        });
        return NextResponse.json(categories, { status: 200 });
    } catch (_error: unknown) {
        const message = _error instanceof Error ? _error.message : String(_error);
        console.error('Erreur lors de la récupération des catégories:', _error);
        return NextResponse.json({ message: 'Erreur interne du serveur lors de la récupération des catégories.', error: message }, { status: 500 });
    }
}

// POST: Créer une nouvelle catégorie (Requiert le rôle ADMIN)
export async function POST(req: NextRequest): Promise<NextResponse> {
    const authResult: AuthResult = await authorizeAdminRequest(req); // MODIFICATION : Passe 'req'
    if (!authResult.authorized) return authResult.response!;

    try {
        const { name, description, imageUrl } = await req.json();

        if (!name || typeof name !== 'string' || name.trim() === '') {
            return NextResponse.json({ message: 'Le nom de la catégorie (chaîne non vide) est requis.' }, { status: 400 });
        }
        if (description !== undefined && typeof description !== 'string' && description !== null) {
            return NextResponse.json({ message: 'La description doit être une chaîne ou null.' }, { status: 400 });
        }
        if (imageUrl !== undefined && typeof imageUrl !== 'string' && imageUrl !== null) {
            return NextResponse.json({ message: 'L\'URL de l\'image doit être une chaîne ou null.' }, { status: 400 });
        }

        const newCategory = await prisma.category.create({
            data: {
                name: name.trim(),
                description: description || null,
                imageUrl: imageUrl || null,
            },
        });

        return NextResponse.json({ message: 'Catégorie créée avec succès !', category: newCategory }, { status: 201 });

    } catch (_error: unknown) {
        const message = _error instanceof Error ? _error.message : String(_error);
        console.error('Erreur lors de la création de la catégorie:', _error);

        if (
            typeof _error === 'object' &&
            _error !== null &&
            'code' in _error &&
            (_error as { code?: string }).code === 'P2002'
        ) {
            return NextResponse.json({ message: 'Cette catégorie existe déjà (nom en double).', error: message }, { status: 409 });
        }

        return NextResponse.json({ message: 'Erreur interne du serveur lors de la création de la catégorie.', error: message }, { status: 500 });
    }
}