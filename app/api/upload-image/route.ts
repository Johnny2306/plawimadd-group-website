// C:\xampp\htdocs\plawimadd_group\app\api\upload-image\route.ts
// Cette route gère le téléchargement d'images vers le dossier public/uploads.

import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs/promises';
import { v4 as uuidv4 } from 'uuid'; // Pour générer des noms de fichiers uniques
import { authorizeAdminRequest, AuthResult } from '@/lib/authUtils'; // Importez la fonction d'autorisation admin

// Définition du répertoire où les images seront stockées
// process.cwd() donne le répertoire courant de l'application (votre dossier plawimadd_group)
const uploadDir = path.join(process.cwd(), 'public', 'uploads');

/**
 * Gère les requêtes POST pour le téléchargement de fichiers.
 * Attend un fichier image dans les FormData sous la clé 'image'.
 * Valide le type de fichier et la taille, puis enregistre le fichier.
 * @param {NextRequest} request La requête Next.js entrante.
 * @returns {Promise<NextResponse>} La réponse JSON avec l'URL de l'image ou un message d'erreur.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
    // 1. Autorisation : Seul un administrateur peut téléverser des images
    const authResult: AuthResult = await authorizeAdminRequest(request);
    if (!authResult.authorized) {
        return authResult.response!; // Renvoie la réponse d'erreur (401, 403)
    }

    try {
        // Parse les données du formulaire (multipart/form-data)
        const formData = await request.formData();
        const file = formData.get('image'); // Récupère le fichier sous la clé 'image'

        // Vérifie si un fichier a été reçu
        if (!file) {
            console.error("Aucun fichier reçu pour l'upload.");
            return NextResponse.json({ message: 'Aucun fichier téléchargé.' }, { status: 400 });
        }

        // Vérifie si l'objet reçu est bien une instance de File (pour le typage et la sécurité)
        if (!(file instanceof File)) {
            console.error("Le champ 'image' n'est pas un fichier valide (instance de File attendue).");
            return NextResponse.json({ message: 'Type de fichier invalide.' }, { status: 400 });
        }

        // Définit les types MIME autorisés et la taille maximale
        const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];
        const maxSizeInBytes = 5 * 1024 * 1024; // 5 Mo

        // Valide le type MIME du fichier
        if (!allowedMimeTypes.includes(file.type)) {
            console.warn(`Tentative d'upload avec un type MIME non autorisé: ${file.type}`);
            return NextResponse.json(
                { message: 'Type de fichier non autorisé. Seuls JPEG, PNG et WEBP sont acceptés.' },
                { status: 415 } // Unsupported Media Type
            );
        }

        // Valide la taille du fichier
        if (file.size > maxSizeInBytes) {
            console.warn(`Tentative d'upload d'un fichier trop volumineux: ${file.size} octets.`);
            return NextResponse.json(
                { message: 'Fichier trop volumineux. Limite: 5 Mo.' },
                { status: 413 } // Payload Too Large
            );
        }

        // Crée le répertoire d'upload s'il n'existe pas
        await fs.mkdir(uploadDir, { recursive: true });

        // Convertit le fichier en Buffer
        const buffer = Buffer.from(await file.arrayBuffer());
        // Génère un nom de fichier unique pour éviter les collisions
        const uniqueSuffix = uuidv4() + path.extname(file.name);
        const filename = `image-${uniqueSuffix}`; // Nom de fichier avec préfixe
        const filePath = path.join(uploadDir, filename);

        // Écrit le fichier sur le disque
        await fs.writeFile(filePath, buffer);

        // Construit l'URL publique de l'image
        const imageUrl = `/uploads/${filename}`;
        console.log(`Image téléchargée avec succès: ${imageUrl}`);

        // Retourne l'URL de l'image téléchargée
        return NextResponse.json({ imageUrl }, { status: 200 });

    } catch (_error: unknown) { // CORRECTION : Renommé 'error' en '_error'
        console.error("Erreur lors de l'upload de l'image :", _error);
        // Gère les erreurs et retourne une réponse d'erreur générique
        const message = _error instanceof Error ? _error.message : 'Erreur inconnue lors du traitement de l\'upload.';
        return NextResponse.json({ message: `Erreur serveur: ${message}` }, { status: 500 });
    }
}

/**
 * Gère les requêtes GET pour cette route.
 * Retourne une erreur 405 car cette route est destinée uniquement aux POST pour l'upload.
 * @returns {Promise<NextResponse>} Une réponse 405 Method Not Allowed.
 */
export async function GET(): Promise<NextResponse> {
    // Le paramètre 'request' n'est pas utilisé ici, donc pas besoin de le renommer en '_request'.
    return NextResponse.json(
        { message: 'Méthode non autorisée. Utilisez POST pour téléverser un fichier.' },
        { status: 405 }
    );
}