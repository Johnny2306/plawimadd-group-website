// C:\xampp\htdocs\plawimadd_group\app\api\users\register\route.ts
// Cette route gère l'inscription de nouveaux utilisateurs.

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import prisma from '@/lib/prisma'; // Importez votre client Prisma
import bcrypt from 'bcryptjs';
// Les imports de 'pool', 'ResultSetHeader', 'uuidv4' ne sont plus nécessaires

interface RegisterRequestBody {
    email: string;
    password: string;
    firstName?: string | null;
    lastName?: string | null;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
    // La variable 'connection' n'est plus nécessaire avec Prisma
    try {
        const body: RegisterRequestBody = await req.json();

        const { email, password, firstName, lastName } = body;

        // 1. Validation basique des données
        if (!email || !password) {
            return NextResponse.json(
                { message: "L'email et le mot de passe sont requis pour l l'inscription." },
                { status: 400 }
            );
        }

        // 2. Vérifier si l'email existe déjà avec Prisma
        const existingUser = await prisma.user.findUnique({
            where: { email: email },
            select: { id: true }, // Ne récupérer que l'ID pour la vérification d'existence
        });

        if (existingUser) {
            return NextResponse.json(
                { message: 'Cet email est déjà enregistré. Veuillez utiliser un autre email ou vous connecter.' },
                { status: 409 } // Conflit
            );
        }

        // 3. Hacher le mot de passe
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // 4. Créer le nouvel utilisateur avec Prisma
        // Prisma générera automatiquement l'UUID pour 'id' grâce à @default(uuid()) dans schema.prisma
        const newUser = await prisma.user.create({
            data: {
                email: email,
                password: hashedPassword,
                firstName: firstName || null, // Assurez-vous que firstName est String? dans schema.prisma
                lastName: lastName || null,   // Assurez-vous que lastName est String? dans schema.prisma
                // 'role' aura sa valeur par défaut (USER) si non spécifié
                // 'createdAt' et 'updatedAt' sont gérés par @default(now()) et @updatedAt
            },
            select: { // Sélectionner les champs à retourner (exclure le mot de passe)
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                role: true,
                createdAt: true,
                updatedAt: true,
                phoneNumber: true, // Incluez d'autres champs non sensibles si nécessaire
            }
        });

        // 5. Retourner la réponse de succès
        return NextResponse.json(
            { message: 'Inscription réussie !', user: newUser }, // Retournez l'objet utilisateur créé (sans mot de passe)
            { status: 201 } // 201 Created est plus approprié pour une inscription réussie
        );
    } catch (_error: unknown) { // Renommé 'error' en '_error'
        console.error("Erreur lors de l'inscription de l'utilisateur:", _error);
        const errorMessage = _error instanceof Error ? _error.message : 'Erreur inconnue.';
        return NextResponse.json(
            { message: `Erreur interne du serveur lors de l'inscription : ${errorMessage}` },
            { status: 500 }
        );
    }
    // Le bloc 'finally' n'est plus nécessaire car Prisma gère ses propres connexions
}

export async function GET(_req: NextRequest): Promise<NextResponse> { // Ajout du typage pour _req
    return NextResponse.json(
        { message: 'Méthode GET non autorisée pour cette route d\'inscription.' },
        { status: 405 }
    );
}