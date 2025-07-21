// app/layout.tsx
import "./globals.css";
import Navbar from "@/components/Navbar";
import SessionProvider from "./SessionProvider";
import { AppProvider } from "@/context/AppContext";
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import Script from "next/script"; // Pour charger Kkiapay correctement
import React, { ReactNode } from 'react';

export const metadata = {
    title: "PlawimAdd - E-commerce",
    description: "Un site e-commerce construit avec Next.js",
};

interface RootLayoutProps {
    children: ReactNode;
}

export default function RootLayout({ children }: RootLayoutProps): React.ReactNode {
    return (
        <html lang="fr" data-scroll-behavior="smooth">
            <body>
                <SessionProvider>
                    <AppProvider>
                        <Navbar />
                        {children}
                        <ToastContainer
                            position="bottom-right"
                            autoClose={3000}
                            hideProgressBar={false}
                            newestOnTop={false}
                            closeOnClick
                            rtl={false}
                            pauseOnFocusLoss
                            draggable
                            pauseOnHover
                            toastClassName="relative flex p-1 min-h-10 rounded-md justify-between overflow-hidden cursor-pointer bg-zinc-50/100 shadow-lg"
                            className="text-sm font-white flex p-3"
                        />
                    </AppProvider>
                </SessionProvider>

                {/* Script Kkiapay chargé proprement avec la nouvelle URL */}
                <Script
                    src="https://cdn.kkiapay.me/k.js" // <-- CORRECTION ICI : Utilisation de .v1.js
                    strategy="afterInteractive"
                />
            </body>
        </html>
    );
}
