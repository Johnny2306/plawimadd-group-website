// app/api/admin/users/route.ts
// Cette route gère la récupération, la modification du rôle et la suppression des utilisateurs par les administrateurs.

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { authorizeAdminRequest, AuthResult } from '@/lib/authUtils';
// Importez les types nécessaires de Prisma pour une meilleure précision
import { Prisma } from '@prisma/client';
import { Prisma as PrismaNamespace } from '@prisma/client'; // Importation du namespace Prisma pour TransactionClient

// GET: Récupérer tous les utilisateurs (avec filtre de rôle optionnel)
export async function GET(req: NextRequest): Promise<NextResponse> {
    const authResult: AuthResult = await authorizeAdminRequest(req);
    if (!authResult.authorized) return authResult.response!;

    try {
        const { searchParams } = new URL(req.url);
        const roleFilter = searchParams.get('role');

        const whereClause: { role?: 'USER' | 'ADMIN' } = {};

        if (roleFilter?.toUpperCase() === 'USER') {
            whereClause.role = 'USER';
        } else if (roleFilter?.toUpperCase() === 'ADMIN') {
            whereClause.role = 'ADMIN';
        }

        // Prisma.UserGetPayload est utilisé pour obtenir le type exact du résultat de la requête findMany avec select
        type UserSelectPayload = Prisma.UserGetPayload<{
            select: {
                id: true;
                firstName: true;
                lastName: true;
                email: true;
                phoneNumber: true;
                role: true;
                createdAt: true;
                updatedAt: true;
            }
        }>;

        const users: UserSelectPayload[] = await prisma.user.findMany({
            where: whereClause,
            select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                phoneNumber: true,
                role: true,
                createdAt: true,
                updatedAt: true,
            },
            orderBy: { createdAt: 'desc' },
        });

        const formattedUsers = users.map((user: UserSelectPayload) => ({ // Utilisation du type UserSelectPayload
            ...user,
            name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email,
        }));

        return NextResponse.json(formattedUsers, { status: 200 });
    } catch (_error: unknown) {
        const message = _error instanceof Error ? _error.message : String(_error);
        console.error('Erreur GET utilisateurs:', _error);
        return NextResponse.json({ message: 'Erreur serveur lors de la récupération des utilisateurs.', error: message }, { status: 500 });
    }
}

// PUT: Modifier le rôle d'un utilisateur
export async function PUT(req: NextRequest): Promise<NextResponse> {
    const authResult: AuthResult = await authorizeAdminRequest(req);
    if (!authResult.authorized) return authResult.response!;

    try {
        const { id, role } = await req.json();

        if (!id || typeof id !== 'string' || !role || typeof role !== 'string') {
            return NextResponse.json({ success: false, message: 'ID utilisateur (chaîne) et rôle (chaîne) valides sont requis.' }, { status: 400 });
        }

        const upperRole = role.toUpperCase();
        if (upperRole !== 'ADMIN' && upperRole !== 'USER') {
            return NextResponse.json({ success: false, message: 'Rôle invalide. Les rôles autorisés sont "ADMIN" ou "USER".' }, { status: 400 });
        }

        // Correction: Utilisation de PrismaNamespace.TransactionClient pour le type du client de transaction
        const updatedUser = await prisma.$transaction(async (tx: PrismaNamespace.TransactionClient) => {
            const result = await tx.user.updateMany({ // Utilisation de 'tx' pour le client de transaction
                where: { id: id },
                data: {
                    role: upperRole as 'ADMIN' | 'USER',
                    updatedAt: new Date(),
                },
            });

            if (result.count === 0) {
                throw new Error('Utilisateur non trouvé ou rôle inchangé.');
            }
            const user = await tx.user.findUnique({ // Utilisation de 'tx' pour le client de transaction
                where: { id: id },
                select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    email: true,
                    phoneNumber: true,
                    role: true,
                    createdAt: true,
                    updatedAt: true,
                }
            });
            return user;
        });

        if (!updatedUser) {
            return NextResponse.json({ success: false, message: 'Utilisateur non trouvé.' }, { status: 404 });
        }

        return NextResponse.json({ success: true, message: 'Rôle utilisateur mis à jour.', user: updatedUser }, { status: 200 });
    } catch (_error: unknown) {
        const message = _error instanceof Error ? _error.message : String(_error);
        console.error('Erreur PUT utilisateur:', _error);
        return NextResponse.json({ success: false, message: 'Erreur serveur lors de la mise à jour du rôle.', error: message }, { status: 500 });
    }
}

// DELETE: Supprimer un utilisateur
export async function DELETE(req: NextRequest): Promise<NextResponse> {
    const authResult: AuthResult = await authorizeAdminRequest(req);
    if (!authResult.authorized) return authResult.response!;

    try {
        const { id } = await req.json();

        if (!id || typeof id !== 'string') {
            return NextResponse.json({ success: false, message: 'ID utilisateur (chaîne) valide est requis pour la suppression.' }, { status: 400 });
        }

        // Correction: Type explicite pour le résultat de deleteMany et type du client de transaction
        const deleteResult: Prisma.BatchPayload = await prisma.$transaction(async (tx: PrismaNamespace.TransactionClient) => { // Utilisation de 'tx' pour le client de transaction
            const result = await tx.user.deleteMany({ // Utilisation de 'tx' pour le client de transaction
                where: { id: id },
            });
            return result;
        });

        if (deleteResult.count === 0) {
            return NextResponse.json({ success: false, message: 'Utilisateur non trouvé ou déjà supprimé.' }, { status: 404 });
        }

        return NextResponse.json({ success: true, message: 'Utilisateur supprimé avec succès.' }, { status: 200 });
    } catch (_error: unknown) {
        console.error('Erreur DELETE utilisateur:', _error);

        if (
            typeof _error === 'object' &&
            _error !== null &&
            'code' in _error &&
            (_error as { code?: string }).code === 'P2003'
        ) {
            return NextResponse.json({
                success: false,
                message: "Impossible de supprimer l'utilisateur car il est lié à d'autres données (commandes, adresses, panier, avis). Supprimez d'abord les données associées ou configurez la suppression en cascade dans votre schéma Prisma."
            }, { status: 409 });
        }

        const message = _error instanceof Error ? _error.message : String(_error);
        return NextResponse.json({ success: false, message: 'Erreur serveur lors de la suppression de l\'utilisateur.', error: message }, { status: 500 });
    }
}
