// types/next-auth.d.ts
// Ce fichier étend les types de NextAuth.js pour inclure vos propriétés personnalisées
// et doit être inclus dans votre tsconfig.json pour être reconnu globalement.

import { DefaultSession, DefaultUser } from "next-auth";
import { JWT as DefaultJWT } from "next-auth/jwt";
import { UserRole } from "@/lib/types"; // <-- IMPORTATION CRUCIALE DE VOTRE ENUM USERROLE

declare module "next-auth/jwt" {
  interface JWT extends DefaultJWT {
    id: string;
    role: UserRole; // Utilise l'enum UserRole importée
    accessToken: string; // Le token d'accès personnalisé
    name: string;
    email: string;
    firstName: string;
    lastName: string;
  }
}

declare module "next-auth" {
  // IMPORTANT : Utiliser 'extends DefaultSession' pour augmenter le type de session par défaut
  interface Session extends DefaultSession {
    user: User & { // L'objet 'user' dans la session aura toutes les propriétés de 'User' PLUS 'token'
      token: string; // C'est ici que le token d'accès est attaché à la session
      role: UserRole; // Ajouté pour être cohérent avec JWT
      firstName: string; // Ajouté pour être cohérent
      lastName: string; // Ajouté pour être cohérent
    };
  }

  // IMPORTANT : Utiliser 'extends DefaultUser' pour augmenter le type d'utilisateur par défaut
  interface User extends DefaultUser {
    id: string;
    role: UserRole; // Utilise l'enum UserRole importée
    firstName: string;
    lastName: string;
    name: string;
    email: string;
  }
}
