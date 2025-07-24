// app/api/upload-image/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { v2 as cloudinary } from 'cloudinary'; // Importation de la librairie Cloudinary

// Assurez-vous d'avoir une utilité pour l'autorisation si nécessaire
// Par exemple, si seuls les administrateurs peuvent télécharger des images
// import { authorizeAdminRequest, AuthResult } from '@/lib/authUtils';

// Définition d'une interface pour le résultat attendu de l'upload Cloudinary
interface CloudinaryUploadResult {
    secure_url: string;
    public_id: string;
    // Ajoutez d'autres propriétés si vous les utilisez (ex: width, height, format)
    // [key: string]: any; // Permet d'ajouter d'autres propriétés dynamiquement si nécessaire, mais essayez d'être plus spécifique
}

// Configuration de Cloudinary avec les variables d'environnement
// Ces variables doivent être définies dans votre fichier .env.local et sur Vercel
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

export async function POST(req: NextRequest): Promise<NextResponse> {
    // --- Section d'autorisation (optionnelle, à adapter selon vos besoins) ---
    // Si vous avez une fonction d'autorisation, vous pouvez l'utiliser ici.
    // Exemple:
    /*
    const authResult: AuthResult = await authorizeAdminRequest(req);
    if (!authResult.authorized) {
        return authResult.response!; // Retourne la réponse d'erreur d'autorisation
    }
    */
    // --- Fin de la section d'autorisation ---

    try {
        // Récupère les données du formulaire envoyées par le client
        const formData = await req.formData();
        // Le nom du champ 'image' doit correspondre à celui utilisé dans le frontend
        const file = formData.get('image') as File;

        // Vérifie si un fichier a été fourni
        if (!file) {
            return NextResponse.json({ message: 'Aucun fichier image fourni.' }, { status: 400 });
        }

        // Convertit le fichier en Buffer pour l'envoi à Cloudinary
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // Télécharge l'image sur Cloudinary
        // La méthode upload_stream permet de streamer le fichier directement
        const uploadResult: CloudinaryUploadResult = await new Promise((resolve, reject) => {
            cloudinary.uploader.upload_stream(
                {
                    folder: 'plawimadd_products', // Dossier sur Cloudinary où les images seront stockées
                    resource_type: 'image' // S'assurer que c'est traité comme une image
                },
                (error, result) => {
                    if (error) {
                        console.error("Erreur de téléchargement Cloudinary:", error);
                        return reject(error);
                    }
                    // S'assurer que le résultat est du bon type avant de résoudre
                    if (result && result.secure_url) {
                        resolve(result as CloudinaryUploadResult);
                    } else {
                        reject(new Error('Cloudinary result is missing secure_url or is null.'));
                    }
                }
            ).end(buffer); // Envoie le buffer du fichier à Cloudinary
        });

        // Vérifie si le téléchargement a réussi et si une URL sécurisée est disponible
        if (!uploadResult || !uploadResult.secure_url) {
            throw new Error('Échec du téléchargement de l\'image sur Cloudinary: URL non retournée.');
        }

        // Retourne l'URL sécurisée de l'image téléchargée
        return NextResponse.json(
            { success: true, message: 'Image téléchargée avec succès.', imageUrl: uploadResult.secure_url },
            { status: 200 }
        );

    } catch (error: unknown) { // Type l'erreur comme 'unknown'
        console.error('Erreur lors du traitement du téléchargement de l\'image:', error);
        let errorMessage = 'Erreur serveur inconnue lors du téléchargement de l\'image.';
        if (error instanceof Error) {
            errorMessage = error.message;
        } else if (typeof error === 'string') {
            errorMessage = error;
        }
        return NextResponse.json(
            { message: `Erreur serveur lors du téléchargement de l'image: ${errorMessage}` },
            { status: 500 }
        );
    }
}
