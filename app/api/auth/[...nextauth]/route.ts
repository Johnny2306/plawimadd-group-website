// app/api/auth/[...nextauth]/route.ts

import NextAuth, { NextAuthOptions, User, Session } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import bcrypt from "bcryptjs";
import { v4 as uuidv4 } from "uuid";
import { JWT } from "next-auth/jwt";
import { PrismaClient } from "@prisma/client";
// Importation spécifique de PrismaClientKnownRequestError et PrismaClientValidationError
import { PrismaClientKnownRequestError, PrismaClientValidationError } from "@prisma/client/runtime/library";
import type { UserRole } from "@/lib/types";

// --- Prisma Singleton ---
// Meilleure pratique pour éviter les instanciations multiples de PrismaClient en développement (Hot Reload)
// En production, chaque requête peut avoir sa propre instance si nécessaire, mais un singleton est courant.
declare global {
  // La directive eslint-disable-next-line no-var a été supprimée car elle était inutilisée et générait un avertissement ESLint.
  var prismaGlobal: PrismaClient | undefined;
}

const prisma =
  global.prismaGlobal ||
  new PrismaClient({
    // Optionnel: Ajouter des logs Prisma pour le débogage si besoin
    // log: ['query', 'info', 'warn', 'error'],
  });

if (process.env.NODE_ENV !== "production") {
  global.prismaGlobal = prisma;
}

// --- Typage étendu ---
// Renommé pour plus de clarté dans les noms de type NextAuth
interface CustomUser extends User {
  id: string;
  role: UserRole;
  firstName: string;
  lastName: string;
}

interface CustomJWT extends JWT {
  id: string;
  role: UserRole;
  accessToken: string; // Utilisé pour une session personnalisée, potentiellement un token JWT pour un autre microservice
  firstName: string;
  lastName: string;
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "text", placeholder: "jsmith@example.com" }, // Ajout d'un placeholder pour l'exemple
        password: { label: "Password", type: "password", placeholder: "********" }, // Ajout d'un placeholder pour l'exemple
      },
      async authorize(credentials): Promise<CustomUser | null> {
        // Log plus détaillé pour les requêtes manquantes
        if (!credentials?.email || !credentials?.password) {
          console.log("Authorize: Email ou mot de passe manquant dans les credentials.");
          // NextAuth renvoie automatiquement un 401 si authorize retourne null
          return null;
        }

        try {
          const user = await prisma.user.findUnique({
            where: { email: credentials.email.toLowerCase() }, // Toujours stocker et comparer les emails en minuscules
          });

          if (!user) {
            console.log(`Authorize: Utilisateur non trouvé pour l'email: ${credentials.email}.`);
            return null;
          }

          // Vérification si le champ password existe sur l'utilisateur récupéré
          if (!user.password) {
            console.error(`Authorize: L'utilisateur ${user.email} n'a pas de mot de passe défini dans la DB.`);
            return null; // L'utilisateur existe mais n'a pas de mot de passe pour la connexion par identifiants
          }

          const isPasswordCorrect = await bcrypt.compare(
            credentials.password,
            user.password
          );

          if (!isPasswordCorrect) {
            console.log(`Authorize: Mot de passe incorrect pour l'email: ${user.email}.`);
            // Pour des raisons de sécurité, éviter de logguer le mot de passe clair
            return null;
          }

          // Retourne l'objet utilisateur étendu
          return {
            id: user.id,
            email: user.email,
            name: `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim(),
            role: (user.role as UserRole) || "USER", // S'assurer que 'role' est bien une 'UserRole'
            firstName: user.firstName ?? "",
            lastName: user.lastName ?? "",
          };
        } catch (error: unknown) {
          // Gestion des erreurs plus spécifique pour Prisma
          if (error instanceof PrismaClientKnownRequestError) {
            // P2002: Unique constraint violation (ex: si on avait un create ici)
            // P2025: Record not found (moins probable ici car géré par !user, mais utile pour d'autres ops)
            console.error(`Authorize: Erreur Prisma (${error.code}):`, error.message);
            // On peut logguer les meta (champs affectés) si disponibles
            if (error.meta) console.error("Prisma Error Meta:", error.meta);
          } else if (error instanceof PrismaClientValidationError) {
            console.error("Authorize: Erreur de validation Prisma (schéma):", error.message);
          } else if (error instanceof Error) {
            console.error("Authorize: Erreur inattendue:", error.message);
          } else {
            console.error("Authorize: Erreur inconnue lors de l'authentification.");
          }
          return null; // Toujours retourner null en cas d'échec d'authentification
        }
      },
    }),

    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    }),
  ],

  pages: {
    signIn: "/sign-in", // S'assurer que cette page existe et est accessible
  },

  callbacks: {
    async jwt({ token, user }): Promise<CustomJWT> {
      // Le 'user' n'est présent que lors de la première connexion/authentification
      // après 'authorize' ou la réception d'un OAuth.
      if (user) {
        const u = user as CustomUser; // Cast pour accéder aux propriétés étendues

        token.id = u.id;
        token.role = u.role;
        token.accessToken = uuidv4(); // Génère un nouveau token d'accès unique pour la session
        token.firstName = u.firstName;
        token.lastName = u.lastName;
        token.name = u.name ?? "";
        token.email = u.email ?? "";
      }
      return token as CustomJWT;
    },

    async session({ session, token }): Promise<Session> {
      // Le 'token' (JWT) est toujours disponible ici. On y injecte les données de session.
      const t = token as CustomJWT; // Cast pour accéder aux propriétés étendues du token

      if (session.user) {
        session.user.id = t.id;
        session.user.role = t.role;
        session.user.token = t.accessToken; // Assurez-vous que votre type Session étendu contient 'token'
        session.user.firstName = t.firstName;
        session.user.lastName = t.lastName;
        session.user.name = t.name;
        session.user.email = t.email;
      }

      return session;
    },
  },

  session: {
    strategy: "jwt", // Utilise JWT pour la gestion des sessions
  },

  // La variable NEXTAUTH_SECRET est ESSENTIELLE pour la sécurité des JWT.
  // Assurez-vous qu'elle est définie et suffisamment complexe.
  // `openssl rand -base64 32` est une bonne méthode pour la générer.
  secret: process.env.NEXTAUTH_SECRET,
};

// Exporte les handlers GET et POST pour la route API de NextAuth.js
const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
