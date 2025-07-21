// types/kkiapay.d.ts - Assurez-vous que le vôtre ressemble EXACTEMENT à ça
interface KkiapayOptions {
    amount: number;
    api_key: string;
    callback: string;
    transaction_id: string;
    email?: string;
    phone?: string;
    position?: "center" | "right" | "left";
    sandbox?: boolean; // Le boolean est plus précis pour true/false
    data?: string;
    theme?: string; // Ajouté si le widget kkiapay-widget a cette prop
    paymentmethod?: "momo" | "card"; // Ajouté si le widget kkiapay-widget a cette prop
    name?: string; // Ajouté si le widget kkiapay-widget a cette prop
}

interface KkiapaySuccessResponse {
    transactionId: string;
    data?: string;
    amount?: number;
    paymentMethod?: string;
    reference?: string;
    status?: string;
    email?: string;
    phone?: string;
}

interface KkiapayErrorReason {
    code?: string;
    message?: string;
}

interface KkiapayErrorResponse {
    transactionId?: string;
    reason?: KkiapayErrorReason;
    message?: string;
}

declare global {
    interface Window {
        openKkiapayWidget: (options: KkiapayOptions) => void;
        addSuccessListener: (callback: (response: KkiapaySuccessResponse) => void) => void;
        addFailedListener: (callback: (error: KkiapayErrorResponse) => void) => void;
        // *** ASSUREZ-VOUS QUE CES DEUX LIGNES SONT PRÉSENTES DANS VOTRE types/kkiapay.d.ts ***
        removeSuccessListener: (callback: (response: KkiapaySuccessResponse) => void) => void;
        removeFailedListener: (callback: (error: KkiapayErrorResponse) => void) => void;
    }

    namespace JSX {
        interface IntrinsicElements {
            'kkiapay-widget': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & KkiapayOptions; // Réutilise KkiapayOptions pour les props du widget
        }
    }
}

export {};