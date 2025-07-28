// app/api/auth/[...nextauth]/route.ts

import NextAuth, { NextAuthOptions, User, Session } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import bcrypt from "bcryptjs";
import { v4 as uuidv4 } from "uuid";
import { JWT } from "next-auth/jwt";
import { PrismaClient } from "@prisma/client";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";
import type { UserRole } from "@/lib/types";

// --- Prisma Singleton ---
declare global {
 
  var prismaGlobal: PrismaClient | undefined;
}

const prisma =
  process.env.NODE_ENV === "production"
    ? new PrismaClient()
    : global.prismaGlobal ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") global.prismaGlobal = prisma;

// --- Typage étendu ---
interface ExtendedUser extends User {
  id: string;
  role: UserRole;
  firstName: string;
  lastName: string;
}

interface ExtendedToken extends JWT {
  id: string;
  role: UserRole;
  accessToken: string;
  firstName: string;
  lastName: string;
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials): Promise<ExtendedUser | null> {
        if (!credentials?.email || !credentials?.password) {
          console.log("Email ou mot de passe manquant");
          return null;
        }

        try {
          const user = await prisma.user.findUnique({
            where: { email: credentials.email },
          });

          if (!user) {
            console.log("Utilisateur non trouvé:", credentials.email);
            return null;
          }

          const isPasswordCorrect = await bcrypt.compare(
            credentials.password,
            user.password
          );

          if (!isPasswordCorrect) {
            console.log("Mot de passe incorrect pour:", user.email);
            return null;
          }

          return {
            id: user.id,
            email: user.email,
            name: `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim(),
            role: (user.role as UserRole) || "USER",
            firstName: user.firstName ?? "",
            lastName: user.lastName ?? "",
          };
        } catch (error: unknown) {
          if (error instanceof PrismaClientKnownRequestError) {
            console.error("Erreur Prisma:", error.message);
          } else if (error instanceof Error) {
            console.error("Erreur:", error.message);
          } else {
            console.error("Erreur inconnue");
          }
          return null;
        }
      },
    }),

    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    }),
  ],

  pages: {
    signIn: "/sign-in",
  },

  callbacks: {
    async jwt({ token, user }): Promise<ExtendedToken> {
      if (user) {
        const u = user as ExtendedUser;

        token.id = u.id;
        token.role = u.role;
        token.accessToken = uuidv4();
        token.firstName = u.firstName;
        token.lastName = u.lastName;
        token.name = u.name ?? "";
        token.email = u.email ?? "";
      }
      return token as ExtendedToken;
    },

    async session({ session, token }): Promise<Session> {
      const t = token as ExtendedToken;

      if (session.user) {
        session.user.id = t.id;
        session.user.role = t.role;
        session.user.token = t.accessToken;
        session.user.firstName = t.firstName;
        session.user.lastName = t.lastName;
        session.user.name = t.name;
        session.user.email = t.email;
      }

      return session;
    },
  },

  session: {
    strategy: "jwt",
  },

  secret: process.env.NEXTAUTH_SECRET,
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
