// app/api/auth/[...nextauth]/route.ts

import NextAuth, { NextAuthOptions, User, Session } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import bcrypt from "bcryptjs";
import { v4 as uuidv4 } from "uuid";
import { JWT } from "next-auth/jwt";
import { PrismaClient } from '@prisma/client';
// Importation manquante pour PrismaClientKnownRequestError
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';

// Initialisez Prisma Client
let prisma: PrismaClient;

if (process.env.NODE_ENV === 'production') {
  prisma = new PrismaClient();
} else {
  if (!(global as any).prisma) { // eslint-disable-line @typescript-eslint/no-explicit-any
    (global as any).prisma = new PrismaClient(); // eslint-disable-line @typescript-eslint/no-explicit-any
  }
  prisma = (global as any).prisma; // eslint-disable-line @typescript-eslint/no-explicit-any
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "text" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials): Promise<User | null> {
        if (!credentials?.email || !credentials?.password) {
          console.log("Authorize: Email ou mot de passe manquant.");
          return null;
        }

        try {
          // Utilisation de Prisma pour trouver l'utilisateur
          const user = await prisma.user.findUnique({
            where: { email: credentials.email },
          });

          if (!user) {
            console.log("Authorize: Utilisateur non trouvé pour l'email:", credentials.email);
            return null;
          }

          // Vérification du mot de passe
          const isPasswordCorrect = await bcrypt.compare(
            credentials.password,
            user.password
          );

          if (!isPasswordCorrect) {
            console.log("Authorize: Mot de passe incorrect pour l'utilisateur:", user.email);
            return null;
          }
          
          if (!user.id || typeof user.id !== 'string') {
            console.error("Authorize: L'ID utilisateur est manquant ou n'est pas une chaîne de caractères de la DB.");
            return null;
          }

          // Retourne l'objet User attendu par NextAuth.js
          return {
            id: user.id,
            email: user.email,
            name: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
            role: user.role || 'USER', // Assurez-vous que le rôle est toujours défini
            firstName: user.firstName || '',
            lastName: user.lastName || ''
          };
        } catch (error: unknown) { // Le type 'unknown' est maintenant géré
          console.error("Erreur dans authorize callback:", error);
          // Vérifiez si l'erreur est une instance de PrismaClientKnownRequestError
          if (error instanceof PrismaClientKnownRequestError) {
            console.error("Prisma Error Code:", error.code);
            console.error("Prisma Error Message:", error.message);
            console.error("Prisma Error Meta:", error.meta);
          } else if (error instanceof Error) { // Gérer d'autres types d'erreurs standard
            console.error("General Error Message:", error.message);
            console.error("General Error Name:", error.name);
          } else { // Si ce n'est ni une erreur Prisma ni une erreur standard
            console.error("An unexpected error occurred:", error);
          }
          return null;
        }
      }
    }),

    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!
    })
  ],

  pages: {
    signIn: "/sign-in"
  },

  callbacks: {
    async jwt({ token, user }): Promise<JWT> {
      if (user) {
        token.id = user.id;
        token.name = user.name;
        token.email = user.email;
        token.role = user.role;
        token.accessToken = uuidv4(); 
        token.firstName = user.firstName || ''; 
        token.lastName = user.lastName || ''; 
      }
      console.log("jwt callback (fin) - Token mis à jour:", token);
      return token;
    },

    async session({ session, token }): Promise<Session> {
      if (session.user && token) {
        session.user.id = token.id;
        session.user.role = token.role;
        session.user.token = token.accessToken; 
        session.user.name = token.name;
        session.user.email = token.email;
        session.user.firstName = token.firstName; 
        session.user.lastName = token.lastName; 
      } else {
          console.warn("session callback: Informations manquantes dans le token pour la session.", { session, token });
      }
      console.log("session callback (fin) - Session mise à jour:", session);
      return session;
    }
  },

  session: {
    strategy: "jwt"
  },

  secret: process.env.NEXTAUTH_SECRET
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
