// C:\xampp\htdocs\plawimadd_group\app\api\contact\route.ts

import { NextRequest, NextResponse } from 'next/server';
// import nodemailer from 'nodemailer'; // À décommenter et configurer si vous voulez envoyer de vrais emails

interface ContactPayload {
    name: string;
    email: string;
    subject: string;
    message: string;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
    try {
        const { name, email, subject, message } = (await req.json()) as ContactPayload;

        // Validation basique des champs requis
        if (!name?.trim() || !email?.trim() || !subject?.trim() || !message?.trim()) {
            return NextResponse.json({ message: 'Tous les champs sont obligatoires.' }, { status: 400 });
        }

        // Validation simple de l'email avec RegExp
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return NextResponse.json({ message: 'Adresse email invalide.' }, { status: 400 });
        }

        // --- Partie à décommenter pour un vrai envoi d'email ---
        /*
        const transporter = nodemailer.createTransport({
            service: 'gmail', // Exemple : Gmail, Outlook, SMTP custom
            auth: {
                user: process.env.EMAIL_USER, // Utilisez des variables d'environnement
                pass: process.env.EMAIL_PASS, // Utilisez des variables d'environnement
            },
        });

        const mailOptions = {
            from: process.env.EMAIL_USER, // Votre adresse email de service
            to: process.env.CONTACT_RECEIVER_EMAIL, // L'adresse où vous voulez recevoir les messages
            replyTo: email,
            subject: `Nouveau message de contact : ${subject} (De ${name})`,
            html: `
                <p><strong>Nom :</strong> ${name}</p>
                <p><strong>Email :</strong> ${email}</p>
                <p><strong>Sujet :</strong> ${subject}</p>
                <p><strong>Message :</strong></p>
                <p>${message}</p>
            `,
        };

        await transporter.sendMail(mailOptions);
        console.log('Email envoyé avec succès !');
        */
        // --- Fin de la partie email ---

        // Logs en mode développement
        console.log('--- Nouveau Message de Contact ---');
        console.log(`Nom: ${name}`);
        console.log(`Email: ${email}`);
        console.log(`Sujet: ${subject}`);
        console.log(`Message: ${message}`);
        console.log('-------------------------------');

        // Simule un délai d’envoi (optionnel)
        await new Promise((resolve) => setTimeout(resolve, 1000));

        return NextResponse.json({ message: 'Message envoyé avec succès !' }, { status: 200 });
    } catch (_error: unknown) { // Correction ESLint: renommé 'error' en '_error'
        const message = _error instanceof Error ? _error.message : String(_error);
        console.error("Erreur dans l'API de contact:", _error); // Afficher l'erreur complète pour le débogage
        return NextResponse.json(
            { message: `Erreur interne du serveur lors de l'envoi du message: ${message}` },
            { status: 500 }
        );
    }
}