// C:\xampp\htdocs\plawimadd_group\app\api\products\route.ts

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { authorizeAdminRequest, AuthResult } from '@/lib/authUtils';

import { Decimal, PrismaClientKnownRequestError } from '@prisma/client/runtime/library';

// Nouveau : Définir le type de la catégorie telle qu'elle sera récupérée par Prisma avec un produit
type CategoryFromPrisma = {
    id: string;
    name: string;
    description: string | null;
    imageUrl: string | null;
    createdAt: Date;
    updatedAt: Date;
};

// Type direct de ce que Prisma renvoie pour un produit avec sa catégorie et ses reviews incluses
type ProductWithRelations = {
    id: string;
    name: string;
    description: string | null;
    price: Decimal;
    stock: number;
    // imgUrl ici est la STRING telle que stockée dans la DB
    imgUrl: string | null;
    createdAt: Date;
    updatedAt: Date;
    offerPrice: Decimal | null;
    categoryId: string;
    category: CategoryFromPrisma;
    reviews: { rating: number }[];
};

interface ProductRequest {
    name: string;
    description: string;
    category: string;
    price: number;
    offerPrice?: number | null;
    stock: number;
    imgUrl: string | string[];
}

// Type pour le produit tel qu'il sera retourné par l'API (après formatage)
type ApiResponseProduct = {
    id: string;
    name: string;
    description: string | null;
    price: number;
    offerPrice: number | null;
    stock: number;
    imgUrl: string[]; // Tableau de chaînes pour le client
    createdAt: Date;
    updatedAt: Date;
    category: {
        id: string;
        name: string;
    };
    rating: number | null;
};


// --- Helper function to parse imgUrl string into a string array ---
// Cette fonction est cruciale pour décoder les chaînes potentiellement doublement/triplement encodées
function parseImgUrl(imgUrlString: string | null): string[] {
    if (!imgUrlString) {
        return [];
    }

    let currentString = imgUrlString;

    // Tenter de parser la chaîne plusieurs fois pour gérer la double (ou triple) sérialisation
    // Nous allons itérer quelques fois pour être sûr de "dérouler" toutes les couches d'encodage.
    // Une chaîne comme ["[\"...\"]"] nécessite 2 parses pour arriver à ["..."].
    for (let i = 0; i < 5; i++) { // Augmenté à 5 pour une robustesse maximale, même si 2-3 suffisent normalement
        try {
            const parsed = JSON.parse(currentString);

            if (Array.isArray(parsed)) {
                // Si c'est un tableau, et que ses éléments sont des chaînes qui ressemblent à du JSON
                // alors c'est une couche de plus à décoder.
                if (parsed.length > 0 && typeof parsed[0] === 'string' && parsed[0].startsWith('[') && parsed[0].endsWith(']')) {
                    currentString = parsed[0]; // Passer à l'élément pour le re-parser
                } else if (parsed.length > 0 && typeof parsed[0] === 'string' && (parsed[0].startsWith('"') || parsed[0].startsWith('{'))) {
                    // Cas où le premier élément est une chaîne qui est elle-même un JSON (e.g., "[\"url\"]")
                    // On tente de la parser, mais seulement si elle est entre guillemets pour éviter de parser une URL simple.
                    try {
                        const reParsed = JSON.parse(parsed[0]);
                        if (Array.isArray(reParsed) && typeof reParsed[0] === 'string') {
                            return reParsed; // Found the final array of strings
                        } else if (typeof reParsed === 'string') {
                            return [reParsed]; // Found a single string URL
                        }
                    } catch {
                        // If re-parsing fails, it was just a string that happened to start with "{" or "[",
                        // so treat the original array as the final one.
                        return parsed.filter((item): item is string => typeof item === 'string');
                    }
                }
                else {
                    // Sinon, c'est un tableau de chaînes d'URL propres (ou d'autres types, que nous filtrerons).
                    return parsed.filter((item): item is string => typeof item === 'string');
                }
            } else if (typeof parsed === 'string') {
                // Si le JSON parsé est une simple chaîne, on la considère comme la "prochaine" chaîne à parser.
                currentString = parsed;
            } else {
                // Si ce n'est ni un tableau, ni une chaîne (ex: null, number, boolean), retourner vide.
                return [];
            }
        } catch (e) {
            // Si JSON.parse échoue, cela signifie que currentString n'est pas un JSON valide.
            // C'est probablement une URL simple ou la couche la plus interne.
            if (typeof currentString === 'string') {
                return [currentString];
            } else {
                return []; // Fallback si ce n'est même pas une chaîne
            }
        }
    }

    // Fallback si la boucle s'est terminée sans trouver un tableau d'URLs propres
    // Cela ne devrait normalement pas arriver avec une boucle de 5 itérations si le format est JSON.
    return (typeof currentString === 'string' ? [currentString] : []);
}


// --- POST (Créer un nouveau produit) ---
export async function POST(req: NextRequest): Promise<NextResponse> {
    const authResult: AuthResult = await authorizeAdminRequest(req);
    if (!authResult.authorized) {
        return authResult.response!;
    }

    try {
        const { name, description, category, price, offerPrice, stock, imgUrl } = await req.json() as ProductRequest;

        if (!name || !description || !category || price === undefined || stock === undefined || !imgUrl) {
            return NextResponse.json(
                { message: 'Tous les champs obligatoires (nom, description, catégorie, prix, stock, URL image) sont requis.' },
                { status: 400 }
            );
        }

        const finalOfferPrice =
            (offerPrice !== undefined && offerPrice !== null && offerPrice > 0)
                ? new Decimal(offerPrice)
                : null;

        // ***** CORRECTION CLÉ ICI : Nettoyer l'entrée imgUrl avant de la stocker *****
        // On utilise parseImgUrl pour s'assurer que l'entrée est propre (tableau de chaînes pures)
        // avant de la sérialiser pour la base de données.
        // Si `imgUrl` est déjà un tableau, on le stringifie pour le passer à parseImgUrl
        const cleanedImgUrlArray = parseImgUrl(Array.isArray(imgUrl) ? JSON.stringify(imgUrl) : String(imgUrl));

        // Maintenant, on stringifie UN SEUL FOIS un tableau de chaînes d'URL propres.
        const imgUrlString = JSON.stringify(cleanedImgUrlArray);


        // --- GESTION DE LA CATÉGORIE ---
        let existingCategory = await prisma.category.findUnique({
            where: { name: category },
        });

        if (!existingCategory) {
            existingCategory = await prisma.category.create({
                data: {
                    name: category,
                },
            });
            console.log(`Catégorie "${category}" créée.`);
        }
        const categoryId = existingCategory.id;
        // --- FIN GESTION DE LA CATÉGORIE ---

        const newProduct = await prisma.product.create({
            data: {
                name: name,
                description: description,
                category: {
                    connect: { id: categoryId },
                },
                price: new Decimal(price),
                offerPrice: finalOfferPrice,
                stock: stock,
                imgUrl: imgUrlString, // Stocke une chaîne JSON propre (e.g., "[\"/path/to/img.jpg\"]")
            },
            include: {
                category: true,
            },
        });

        // Utilisez la fonction d'aide pour parser newProduct.imgUrl avant de l'assigner
        const parsedImgUrls = parseImgUrl(newProduct.imgUrl);

        const responseNewProduct: ApiResponseProduct = {
            id: newProduct.id,
            name: newProduct.name,
            description: newProduct.description,
            price: parseFloat(newProduct.price.toString()),
            offerPrice: newProduct.offerPrice ? parseFloat(newProduct.offerPrice.toString()) : null,
            stock: newProduct.stock,
            createdAt: newProduct.createdAt,
            updatedAt: newProduct.updatedAt,
            imgUrl: parsedImgUrls, // Assignez le tableau parsé ici
            category: {
                id: newProduct.category.id,
                name: newProduct.category.name,
            },
            rating: null,
        };

        return NextResponse.json(
            { message: 'Produit ajouté avec succès.', product: responseNewProduct },
            { status: 201 }
        );

    } catch (_error: unknown) {
        console.error('Erreur lors de l\'ajout du produit:', _error);
        if (_error instanceof PrismaClientKnownRequestError) {
            if (_error.code === 'P2002') {
                return NextResponse.json({ success: false, message: 'Un produit avec ces caractéristiques existe déjà.' }, { status: 409 });
            }
        }
        const errorMessage = _error instanceof Error ? _error.message : String(_error);
        return NextResponse.json(
            { message: `Erreur serveur lors de l'ajout du produit : ${errorMessage}` },
            { status: 500 }
        );
    }
}

// --- GET (Récupérer tous les produits) ---
export async function GET(_req: NextRequest): Promise<NextResponse> {
    try {
        const products = await prisma.product.findMany({
            include: {
                category: true,
                reviews: true,
            },
        });

        const formattedProducts: ApiResponseProduct[] = products.map((product: ProductWithRelations) => {
            const totalRating = product.reviews.reduce((sum, review) => sum + review.rating, 0);
            const averageRating = product.reviews.length > 0 ? totalRating / product.reviews.length : null;

            // Utilisez la fonction d'aide pour parser product.imgUrl avant de l'assigner
            const parsedImgUrls = parseImgUrl(product.imgUrl);

            const formattedProduct: ApiResponseProduct = {
                id: product.id,
                name: product.name,
                description: product.description,
                stock: product.stock,
                createdAt: product.createdAt,
                updatedAt: product.updatedAt,
                price: parseFloat(product.price.toString()),
                offerPrice: product.offerPrice ? parseFloat(product.offerPrice.toString()) : null,
                imgUrl: parsedImgUrls, // Assignez le tableau parsé ici
                category: {
                    id: product.category.id,
                    name: product.category.name,
                },
                rating: averageRating,
            };
            return formattedProduct;
        });

        return NextResponse.json(formattedProducts, { status: 200 });

    } catch (_error: unknown) {
        console.error('Erreur lors de la récupération des produits:', _error);
        const errorMessage = _error instanceof Error ? _error.message : String(_error);
        return NextResponse.json(
            { message: `Erreur serveur lors de la récupération des produits : ${errorMessage}` },
            { status: 500 }
        );
    }
}