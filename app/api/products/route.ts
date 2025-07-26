// app/api/products/route.ts

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
    rating: number | null; // Ajouté pour correspondre au schéma Prisma
    brand: string | null; // Ajouté pour correspondre au schéma Prisma
    color: string | null; // Ajouté pour correspondre au schéma Prisma
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
    brand?: string | null; // Ajouté pour le POST
    color?: string | null; // Ajouté pour le POST
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
    brand: string | null; // Ajouté pour la réponse API
    color: string | null; // Ajouté pour la réponse API
};


// --- Helper function to parse imgUrl string into a string array ---
// Cette fonction est cruciale pour décoder les chaînes potentiellement doublement/triplement encodées
function parseImgUrl(imgUrlString: string | null): string[] {
    if (!imgUrlString) {
        return [];
    }

    let currentString = imgUrlString;

    // Tenter de parser la chaîne plusieurs fois pour gérer la double (ou triple) sérialisation
    for (let i = 0; i < 5; i++) {
        try {
            const parsed = JSON.parse(currentString);

            if (Array.isArray(parsed)) {
                // Si c'est un tableau, vérifiez si ses éléments sont des chaînes JSON encodées
                if (parsed.length > 0 && typeof parsed[0] === 'string' && parsed[0].startsWith('[') && parsed[0].endsWith(']')) {
                    currentString = parsed[0]; // C'est un tableau stringifié à l'intérieur d'un tableau
                } else if (parsed.length > 0 && typeof parsed[0] === 'string' && (parsed[0].startsWith('"') || parsed[0].startsWith('{'))) {
                    // C'est un tableau de chaînes qui sont elles-mêmes stringifiées ou des objets JSON
                    try {
                        const reParsed = JSON.parse(parsed[0]);
                        if (Array.isArray(reParsed) && typeof reParsed[0] === 'string') {
                            return reParsed; // C'est le tableau final d'URLs
                        } else if (typeof reParsed === 'string') {
                            return [reParsed]; // C'est une seule URL stringifiée
                        }
                    } catch {
                        // Si le re-parsing échoue, c'est probablement un tableau de chaînes déjà propres
                        return parsed.filter((item): item is string => typeof item === 'string');
                    }
                }
                else {
                    // C'est un tableau de chaînes déjà propres
                    return parsed.filter((item): item is string => typeof item === 'string');
                }
            } else if (typeof parsed === 'string') {
                currentString = parsed; // C'est une chaîne stringifiée, continuer le parsing
            } else {
                // Ce n'est ni un tableau, ni une chaîne stringifiée, ni une chaîne simple.
                return [];
            }
        } catch (e) {
            // Si JSON.parse échoue, c'est probablement une chaîne simple non JSON
            if (typeof currentString === 'string') {
                return [currentString]; // Retourne la chaîne simple dans un tableau
            } else {
                return [];
            }
        }
    }

    // Après plusieurs tentatives, si c'est encore une chaîne, la retourner dans un tableau.
    // Sinon, retourner un tableau vide.
    return (typeof currentString === 'string' ? [currentString] : []);
}


// --- POST (Créer un nouveau produit) ---
export async function POST(req: NextRequest): Promise<NextResponse> {
    const authResult: AuthResult = await authorizeAdminRequest(req);
    if (!authResult.authorized) {
        return authResult.response!;
    }

    try {
        const { name, description, category, price, offerPrice, stock, imgUrl, brand, color } = await req.json() as ProductRequest;

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

        // Appelez parseImgUrl pour obtenir le tableau propre,
        // puis stringifiez-le UNE SEULE FOIS pour la base de données.
        const cleanedImgUrlArray = parseImgUrl(Array.isArray(imgUrl) ? JSON.stringify(imgUrl) : String(imgUrl));
        const imgUrlToSave = JSON.stringify(cleanedImgUrlArray); // Stringifier une seule fois


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
                imgUrl: imgUrlToSave, // Utilise la chaîne JSON propre
                brand: brand || null,
                color: color || null,
            },
            include: {
                category: true,
            },
        });

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
            imgUrl: parsedImgUrls,
            category: {
                id: newProduct.category.id,
                name: newProduct.category.name,
            },
            rating: newProduct.rating,
            brand: newProduct.brand,
            color: newProduct.color,
        };

        return NextResponse.json(
            { message: 'Produit ajouté avec succès.', product: responseNewProduct },
            { status: 201 }
        );

    } catch (error: unknown) {
        console.error('Erreur lors de l\'ajout du produit:', error);
        if (error instanceof PrismaClientKnownRequestError) {
            if (error.code === 'P2002') {
                return NextResponse.json({ success: false, message: 'Un produit avec ces caractéristiques existe déjà.' }, { status: 409 });
            }
        }
        const errorMessage = error instanceof Error ? error.message : String(error);
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
                brand: product.brand,
                color: product.color,
            };
            return formattedProduct;
        });

        // Enveloppez la réponse dans un objet { success: true, data: ... }
        return NextResponse.json({ success: true, data: formattedProducts }, { status: 200 });

    } catch (error: unknown) {
        console.error('Erreur lors de la récupération des produits:', error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        return NextResponse.json(
            { success: false, message: `Erreur serveur lors de la récupération des produits : ${errorMessage}` },
            { status: 500 }
        );
    }
}
