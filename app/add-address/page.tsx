'use client';

import React, { useState, useEffect, ChangeEvent, FormEvent } from "react";
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

interface AddressFormState {
    fullName: string;
    phoneNumber: string;
    pincode: string;
    area: string;
    city: string;
    state: string;
}

interface InputFieldConfig {
    name: keyof AddressFormState;
    placeholder: string;
    Icon: IconType;
    required: boolean;
    type: string;
}

const AddAddress = (): React.ReactElement => {
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
    const [message, setMessage] = useState<string>('');
    const [isClient, setIsClient] = useState<boolean>(false);

    useEffect(() => {
        setIsClient(true);
        if (status === 'authenticated' && session?.user) {
            const role = (session.user as { role?: string }).role;
            const userFromSession: User = {
                id: session.user.id ? String(session.user.id) : (session.user.email || 'unknown_id'),
                name: session.user.name || null,
                email: session.user.email || null,
                image: session.user.image || null,
                token: (session.user as { token?: string }).token || undefined,
                role: role === "ADMIN" ? "ADMIN" : "USER",
            };
            setCurrentUser(userFromSession);
        } else if (status === 'unauthenticated') {
            setCurrentUser(null);
        }
    }, [session, status, setCurrentUser]);

    const onChangeHandler = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setAddress((prev) => ({ ...prev, [name]: value }));
    };

    const onSubmitHandler = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setMessage('');

        if (!currentUser?.id) {
            toast.error("Veuillez vous connecter pour ajouter une adresse.");
            router.push('/login');
            return;
        }

        if (!address.fullName || !address.phoneNumber || !address.area || !address.city || !address.state) {
            toast.error("Veuillez remplir tous les champs obligatoires.");
            return;
        }

        try {
            const headers: Record<string, string> = { 'Content-Type': 'application/json' };
            if (currentUser.token) headers['auth-token'] = currentUser.token;

            const payload: Partial<Address> = {
                ...address,
                isDefault: false,
            };

            const res = await axios.post(
                `${url}/api/addresses/${currentUser.id}`,
                payload,
                { headers }
            );

            const data: { success: boolean; message?: string; addressId?: string } = res.data;

            if (res.status === 201 && data.success) {
                toast.success(data.message || "Adresse ajoutée !");
                setAddress({
                    fullName: '',
                    phoneNumber: '',
                    pincode: '',
                    area: '',
                    city: '',
                    state: '',
                });
                fetchUserAddresses();
                router.push('/cart');
            } else {
                toast.error(`Erreur: ${data.message || "Échec de l'ajout."}`);
            }
        } catch (error: unknown) {
            console.error("Erreur lors de l'ajout:", error);
            if (axios.isAxiosError(error) && error.response) {
                toast.error(error.response.data?.message || 'Erreur serveur');
            } else {
                toast.error('Erreur inattendue');
            }
        }
    };

    if (!isClient || status === 'loading') {
        return (
            <div className="flex justify-center items-center h-screen bg-gray-100">
                <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-b-4 border-blue-600"></div>
            </div>
        );
    }

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
                                {inputFields.map(({ name, placeholder, Icon, required, type }) => (
                                    <div key={name} className="relative">
                                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                            <Icon className="text-gray-400" size={20} />
                                        </div>
                                        <input
                                            type={type}
                                            name={name}
                                            placeholder={placeholder}
                                            value={address[name] || ''}
                                            onChange={onChangeHandler}
                                            required={required}
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
                                    {cityStateFields.map(({ name, placeholder, Icon, required, type }) => (
                                        <div key={name} className="relative">
                                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                                <Icon className="text-gray-400" size={20} />
                                            </div>
                                            <input
                                                type={type}
                                                name={name}
                                                placeholder={placeholder}
                                                value={address[name] || ''}
                                                onChange={onChangeHandler}
                                                required={required}
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
