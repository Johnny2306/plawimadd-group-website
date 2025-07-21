// app/privacy-policy/page.tsx
'use client';
import React from 'react';
import { FaShieldAlt, FaUserSecret, FaLock } from 'react-icons/fa';

/**
 * Composant de la page "Politique de Confidentialité".
 * Affiche les informations sur la collecte, l'utilisation et la protection des données personnelles.
 * @returns {React.ReactElement} Le JSX de la page de politique de confidentialité.
 */
const PrivacyPolicy = (): React.ReactElement => {
    const currentYear = new Date().getFullYear(); // Récupérer l'année une seule fois pour le pied de page
    const contactEmail = 'plawimaddgroup1beninbranch@gmail.com'; // Définir l'e-mail de contact une seule fois

    return (
        <div className='bg-gradient-to-b from-blue-50 via-white to-blue-50 min-h-screen py-10 px-6 md:px-12 lg:px-20'>
            <div className='max-w-5xl mx-auto bg-white p-10 rounded-2xl shadow-2xl border-t-4 border-blue-500'>
                <div className='text-center mb-10'>
                    <h1 className='text-4xl font-extrabold text-gray-800 mb-4'>Politique de Confidentialité</h1>
                    <p className='text-gray-600 text-lg leading-relaxed'>
                        Votre confidentialité est notre priorité. Découvrez comment nous protégeons vos informations personnelles.
                    </p>
                </div>

                <div className='space-y-12'>
                    {/* Section 1: Collecte des informations */}
                    <section aria-labelledby="section-collecte">
                        <div className='flex items-center space-x-3 mb-4'>
                            <FaShieldAlt className='text-blue-500 text-3xl flex-shrink-0' aria-hidden='true' /> {/* flex-shrink-0 pour que l'icône ne se réduise pas */}
                            <h2 id="section-collecte" className='text-2xl font-bold text-gray-800'>1. Collecte des informations</h2>
                        </div>
                        <p className='text-gray-700 leading-relaxed'> {/* Lighter gray for better contrast */}
                            Nous collectons vos informations personnelles lorsque vous utilisez notre site ou nos services. Cela peut inclure votre nom, adresse e-mail, numéro de téléphone, et d&#39;autres détails fournis lors de la création d&#39;un compte ou d&#39;une commande.
                        </p>
                    </section>

                    {/* Section 2: Utilisation des informations */}
                    <section aria-labelledby="section-utilisation">
                        <div className='flex items-center space-x-3 mb-4'>
                            <FaUserSecret className='text-blue-500 text-3xl flex-shrink-0' aria-hidden='true' />
                            <h2 id="section-utilisation" className='text-2xl font-bold text-gray-800'>2. Utilisation des informations</h2>
                        </div>
                        <p className='text-gray-700 leading-relaxed'>
                            Vos informations sont utilisées pour :
                        </p>
                        <ul className='list-disc list-inside text-gray-700 pl-6 space-y-2 mt-4'> {/* Added mt-4 for spacing */}
                            <li>Traiter vos commandes et paiements.</li>
                            <li>Fournir un service client personnalisé.</li>
                            <li>Améliorer nos produits et services.</li>
                            <li>Vous informer sur nos promotions et offres spéciales.</li>
                        </ul>
                    </section>

                    {/* Section 3: Sécurité des données */}
                    <section aria-labelledby="section-securite">
                        <div className='flex items-center space-x-3 mb-4'>
                            <FaLock className='text-blue-500 text-3xl flex-shrink-0' aria-hidden='true' />
                            <h2 id="section-securite" className='text-2xl font-bold text-gray-800'>3. Sécurité des données</h2>
                        </div>
                        <p className='text-gray-700 leading-relaxed'>
                            Nous utilisons des mesures techniques et organisationnelles pour protéger vos données contre tout accès non autorisé, perte ou modification.
                        </p>
                    </section>

                    {/* Section 4: Vos droits */}
                    <section aria-labelledby="section-droits">
                        <h2 id="section-droits" className='text-2xl font-bold text-gray-800 mb-4'>4. Vos droits</h2>
                        <p className='text-gray-700 leading-relaxed'>
                            Vous avez le droit d&#39;accéder à vos données, de les corriger ou de demander leur suppression. Pour exercer ces droits, contactez-nous à :
                        </p>
                        <p className='mt-2'>
                            <a
                                href={`mailto:${contactEmail}`}
                                className='text-blue-600 hover:text-blue-800 hover:underline font-semibold text-lg transition-colors duration-200' // Added transition for smooth hover
                            >
                                {contactEmail}
                            </a>
                        </p>
                    </section>

                    {/* Section 5: Modifications de cette politique */}
                    <section aria-labelledby="section-modifications">
                        <h2 id="section-modifications" className='text-2xl font-bold text-gray-800 mb-4'>5. Modifications de cette politique</h2>
                        <p className='text-gray-700 leading-relaxed'>
                            Nous pouvons mettre à jour cette politique de confidentialité de temps en temps. Toute modification sera publiée sur cette page.
                        </p>
                    </section>

                    {/* Section 6: Contact */}
                    <section aria-labelledby="section-contact">
                        <h2 id="section-contact" className='text-2xl font-bold text-gray-800 mb-4'>6. Contact</h2>
                        <p className='text-gray-700 leading-relaxed'>
                            Si vous avez des questions concernant cette politique, vous pouvez nous contacter à :
                        </p>
                        <p>
                            <a
                                href={`mailto:${contactEmail}`}
                                className='text-blue-600 hover:text-blue-800 hover:underline font-semibold text-lg transition-colors duration-200'
                            >
                                {contactEmail}
                            </a>
                        </p>
                    </section>
                </div>

                <div className='mt-12 text-center border-t border-gray-200 pt-6'> {/* Added a subtle border top for separation */}
                    <p className='text-gray-500 text-sm'>
                        Développé par Tiburce & Jean. &copy; {currentYear} Plawimadd Group. Tous droits réservés.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default PrivacyPolicy;