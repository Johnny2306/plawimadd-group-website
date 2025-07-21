// C:\xampp\htdocs\plawimadd_group\app\api\auth\[...nextauth]\route.ts

import NextAuth, { NextAuthOptions, User, Session } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import bcrypt from "bcryptjs";
import pool from "@/lib/db";
import { v4 as uuidv4 } from "uuid";
import { RowDataPacket } from "mysql2";
import { JWT } from "next-auth/jwt";

interface DBUser extends RowDataPacket {
  id: string;
  email: string;
  password: string;
  role: "ADMIN" | "USER";
  firstName: string;
  lastName: string;
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
        if (!credentials?.email || !credentials?.password) return null;

        const connection = await pool.getConnection();
        try {
          const [rows] = await connection.query<DBUser[]>(
            "SELECT id, email, password, role, firstName, lastName FROM users WHERE email = ?",
            [credentials.email]
          );

          const user = rows[0];
          if (!user) return null;

          const isPasswordCorrect = await bcrypt.compare(
            credentials.password,
            user.password
          );
          if (!isPasswordCorrect) return null;
          
          if (!user.id || typeof user.id !== 'string') {
            console.error("User ID is missing or not a string from DB record after authorization.");
            return null;
          }

          return {
            id: user.id,
            email: user.email,
            name: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
            role: user.role,
            firstName: user.firstName || '',
            lastName: user.lastName || ''
          };
        } catch (_error: unknown) { // Renommé 'error' en '_error'
          console.error("Erreur authorize:", _error);
          return null;
        } finally {
          connection.release();
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