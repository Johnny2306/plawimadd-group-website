// app/add-address/page.tsx
'use client';

import React, { useState, useEffect, ChangeEvent, FormEvent } from "react"; // Importez ChangeEvent et FormEvent
import Image from "next/image";
import { useAppContext } from "@/context/AppContext";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import axios from "axios";
import { toast } from 'react-toastify';
import { IconType } from 'react-icons';
import { FiUser, FiPhone, FiMapPin, FiHome, FiNavigation, FiMail, FiSave } from 'react-icons/fi';
import { IoLocationOutline } from 'react-icons/io5';
import { User, Address } from '@/lib/types';
import { assets } from "@/assets/assets";
import Footer from "@/components/Footer";


// Interface pour l'état du formulaire d'adresse
// C'est un sous-ensemble de l'interface Address complète, car le formulaire ne gère pas tous les champs
interface AddressFormState {
    fullName: string;
    phoneNumber: string;
    pincode: string;
    area: string;
    city: string;
    state: string;
    // isDefault, id, _id, street, country ne sont pas des champs de formulaire directs ici
}

// Interface pour les configurations des champs d'entrée
interface InputFieldConfig {
    name: keyof AddressFormState; // Le nom doit correspondre à une clé de AddressFormState
    placeholder: string;
    Icon: IconType; // Type pour les composants d'icônes de react-icons
    required: boolean;
    type: string; // Pour l'attribut 'type' de l'input (ex: 'text', 'tel')
}


const AddAddress = (): React.ReactElement => { // Type le composant comme retournant un React.ReactElement
    const { currentUser, setCurrentUser, url, fetchUserAddresses } = useAppContext();
    const router = useRouter();
    const { data: session, status } = useSession();

    const [address, setAddress] = useState<AddressFormState>({
        fullName: '',
        phoneNumber: '',
        pincode: '',
        area: '',
        city: '',
        state: '',
    });
    const [message, setMessage] = useState<string>(''); // Type l'état du message comme string
    const [isClient, setIsClient] = useState<boolean>(false); // Type l'état comme boolean

    useEffect(() => {
        setIsClient(true);
        if (status === 'authenticated' && session?.user) {
            const userFromSession: User = {
                id: session.user.id ? String(session.user.id) : (session.user.email || 'unknown_id'), // Assurez-vous que l'ID est une string
                name: session.user.name || null,
                email: session.user.email || null,
                image: session.user.image || null,
                token: (session.user as { token?: string }).token || undefined, // Assurez-vous que 'token' est géré
                role: (["USER", "ADMIN", "SELLER"].includes((session.user as { role?: string }).role ?? "")
                    ? (session.user as { role?: "USER" | "ADMIN" | "SELLER" }).role
                    : "USER"),
            };
            setCurrentUser(userFromSession);
        } else if (status === 'unauthenticated') {
            setCurrentUser(null);
        }
    }, [session, status, setCurrentUser]);

    // Type l'événement de changement
    const onChangeHandler = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setAddress((prevAddress) => ({
            ...prevAddress,
            [name]: value,
        }));
    };

    // Type l'événement de soumission
    const onSubmitHandler = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setMessage('');

        if (!currentUser || !currentUser.id) {
            setMessage("Erreur: Utilisateur non connecté. Redirection vers la page de connexion...");
            toast.error("Veuillez vous connecter pour ajouter une adresse.");
            router.push('/login');
            return;
        }

        if (!address.fullName || !address.phoneNumber || !address.area || !address.city || !address.state) {
            setMessage("Erreur: Veuillez remplir tous les champs obligatoires (Nom complet, Numéro de téléphone, Adresse, Ville, Région).");
            toast.error("Veuillez remplir tous les champs obligatoires.");
            return;
        }

        try {
            const headers: Record<string, string> = { 'Content-Type': 'application/json' };
            if (currentUser.token) {
                headers['auth-token'] = typeof currentUser.token === 'string' ? currentUser.token : '';
            }

            // Le payload de l'adresse doit correspondre à l'interface Address de lib/types.ts
            // Assurez-vous que isDefault est géré côté backend ou ajoutez-le ici si nécessaire
            const addressPayload: Partial<Address> = { // Utilisez Partial car tous les champs ne sont pas dans le formulaire
                ...address,
                isDefault: false, // Par défaut, une nouvelle adresse n'est pas la valeur par défaut
                // id et _id seront générés par le backend
            };

            const response = await axios.post(
                `${url}/api/addresses/${currentUser.id}`,
                addressPayload, // Utilisez le payload typé
                { headers }
            );

            const data: { success: boolean; message?: string; addressId?: string } = response.data; // Type la réponse de l'API

            if (response.status === 201 && data.success) {
                setMessage(data.message || "Adresse ajoutée avec succès !");
                toast.success(data.message || "Adresse ajoutée avec succès !");
                // Réinitialiser le formulaire
                setAddress({
                    fullName: '',
                    phoneNumber: '',
                    pincode: '',
                    area: '',
                    city: '',
                    state: '',
                });
                fetchUserAddresses(); // Rafraîchir la liste des adresses dans le contexte
                router.push('/cart'); // Rediriger vers le panier après l'ajout
            } else {
                setMessage(`Erreur: ${data.message || "Échec de l'ajout de l'adresse."}`);
                toast.error(`Erreur: ${data.message || "Échec de l'ajout de l'adresse."}`);
            }
        } catch (error: unknown) { // Type l'erreur comme unknown
            console.error('Erreur lors de l\'envoi de l\'adresse:', error);
            if (axios.isAxiosError(error) && error.response) { // Utilise axios.isAxiosError pour affiner le type
                setMessage(`Erreur: ${error.response.data?.message || 'Problème serveur.'}`);
                toast.error(`Erreur: ${error.response.data?.message || 'Problème serveur.'}`);
            } else if (error instanceof Error) { // Gère les erreurs JavaScript standard
                setMessage(`Erreur: Pas de réponse du serveur. Vérifiez votre connexion. (${error.message})`);
                toast.error(`Erreur: Pas de réponse du serveur.`);
            } else { // Gère les erreurs inattendues
                setMessage(`Erreur inattendue: ${String(error)}`);
                toast.error(`Erreur inattendue: ${String(error)}`);
            }
        }
    };

    // Affichage du loader pendant le chargement côté client ou la session
    if (!isClient || status === 'loading') {
        return (
            <div className="flex justify-center items-center h-screen bg-gray-100">
                <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-b-4 border-blue-600"></div>
            </div>
        );
    }

    // Configuration des champs d'entrée pour le formulaire
    const inputFields: InputFieldConfig[] = [
        { name: 'fullName', placeholder: 'Nom complet', Icon: FiUser, required: true, type: 'text' },
        { name: 'phoneNumber', placeholder: 'Numéro de téléphone', Icon: FiPhone, required: true, type: 'tel' },
        { name: 'pincode', placeholder: 'Code postal', Icon: FiMapPin, required: false, type: 'text' },
    ];

    const cityStateFields: InputFieldConfig[] = [
        { name: 'city', placeholder: 'Ville', Icon: FiNavigation, required: true, type: 'text' },
        { name: 'state', placeholder: 'Région', Icon: FiMail, required: true, type: 'text' },
    ];


    return (
        <>
            <div className="min-h-screen bg-gray-100">
                <div className="container mx-auto px-6 py-16">
                    <div className="max-w-5xl mx-auto bg-white rounded-2xl shadow-lg overflow-hidden md:flex">
                        <div className="md:w-1/2 p-10 md:p-16">
                            <div className="flex items-center mb-8">
                                <IoLocationOutline className="text-blue-600 text-4xl mr-4" />
                                <h1 className="text-3xl font-extrabold text-gray-900">
                                    Ajouter une <span className="text-blue-600">Adresse</span>
                                </h1>
                            </div>
                            
                            <form onSubmit={onSubmitHandler} className="space-y-6">
                                {inputFields.map((field) => (
                                    <div key={field.name} className="relative">
                                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                            <field.Icon className="text-gray-400" size={20} />
                                        </div>
                                        <input
                                            type={field.type}
                                            name={field.name}
                                            placeholder={field.placeholder}
                                            // Assurez-vous que la valeur est toujours une string, car address[name] pourrait être undefined
                                            value={address[field.name as keyof AddressFormState] || ''}
                                            onChange={onChangeHandler}
                                            required={field.required}
                                            className="pl-12 pr-4 py-3 w-full border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400
                                            focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition duration-200"
                                        />
                                    </div>
                                ))}

                                <div className="relative">
                                    <div className="absolute top-3 left-4 flex items-start pointer-events-none">
                                        <FiHome className="text-gray-400" size={20} />
                                    </div>
                                    <textarea
                                        name="area"
                                        placeholder="Adresse"
                                        rows={4}
                                        value={address.area}
                                        onChange={onChangeHandler}
                                        required
                                        className="pl-12 pr-4 py-3 w-full border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400
                                        focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition duration-200 resize-none"
                                    />
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {cityStateFields.map((field) => (
                                        <div key={field.name} className="relative">
                                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                                <field.Icon className="text-gray-400" size={20} />
                                            </div>
                                            <input
                                                type={field.type}
                                                name={field.name}
                                                placeholder={field.placeholder}
                                                value={address[field.name as keyof AddressFormState] || ''}
                                                onChange={onChangeHandler}
                                                required={field.required}
                                                className="pl-12 pr-4 py-3 w-full border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400
                                                focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition duration-200"
                                            />
                                        </div>
                                    ))}
                                </div>

                                {message && (
                                    <div className={`px-4 py-3 rounded-lg text-sm font-medium ${
                                        message.startsWith('Erreur')
                                            ? 'bg-red-100 text-red-700'
                                            : 'bg-green-100 text-green-700'
                                    }`}>
                                        {message}
                                    </div>
                                )}

                                <button 
                                    type="submit" 
                                    className="w-full flex items-center justify-center space-x-3 bg-blue-600 hover:bg-blue-700 active:bg-blue-800
                                    text-white font-semibold py-3 rounded-lg shadow-md transition duration-300 focus:outline-none focus:ring-4 focus:ring-blue-300"
                                >
                                    <FiSave size={20} />
                                    <span>Enregistrer l&apos;adresse</span>
                                </button>
                            </form>
                        </div>

                        <div className="hidden md:flex md:w-1/2 bg-blue-50 items-center justify-center p-12">
                            <div className="text-center">
                                <Image
                                    src={assets.my_location_image}
                                    alt="Image de localisation"
                                    width={400}
                                    height={400}
                                    className="mx-auto rounded-xl shadow-lg"
                                    priority
                                />
                                <h3 className="mt-8 text-2xl font-semibold text-gray-800">Votre adresse est importante</h3>
                                <p className="mt-3 text-gray-600 max-w-sm mx-auto">
                                    Nous avons besoin de votre adresse pour vous livrer vos commandes et vous offrir la meilleure expérience possible.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <Footer />
        </>
    );
};

export default AddAddress;
