// app/SessionProvider.tsx
'use client'; // TRÈS IMPORTANT : Doit être un Client Component

import { SessionProvider } from "next-auth/react";
import React, { ReactNode } from 'react'; // Importez ReactNode

/**
 * Interface pour les props du composant NextAuthSessionProvider.
 * Il accepte un seul prop: 'children'.
 */
interface NextAuthSessionProviderProps {
  children: ReactNode; // 'children' est le contenu React que le composant enveloppe.
}

/**
 * Ce composant enveloppe votre application pour fournir le contexte de session de NextAuth.js.
 * Il doit être un Client Component pour utiliser `SessionProvider` de `next-auth/react`.
 *
 * @param {NextAuthSessionProviderProps} { children } Les enfants React à rendre à l'intérieur du fournisseur de session.
 */
export default function NextAuthSessionProvider({ children }: NextAuthSessionProviderProps) {
  return (
    <SessionProvider>
      {children}
    </SessionProvider>
  );
}
