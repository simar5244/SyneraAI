'use client';

import React from 'react';
import Link from 'next/link';

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-gradient-to-r from-purple-50 to-pink-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto bg-white rounded-xl shadow-lg overflow-hidden p-8">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Privacy Policy</h1>
          <p className="text-lg text-gray-600">Effective Date: June 17, 2025</p>
        </div>

        <div className="prose max-w-none space-y-8">
          <section>
            <h2 className="text-2xl font-bold text-gray-800 mb-4 pb-2 border-b border-gray-200">1. Introduction</h2>
            <p className="text-gray-700 leading-relaxed">
              SyneraAI LLC ("we," "us," or "our") respects your privacy and is committed to protecting your personal information. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our website, mobile application, and services (collectively, the "Service").
            </p>
            <p className="text-gray-700 leading-relaxed mt-4">
              Please read this Privacy Policy carefully. By accessing or using our Service, you acknowledge that you have read, understood, and agree to be bound by all the terms of this Privacy Policy. If you do not agree with or you are not comfortable with any aspect of this Privacy Policy, you should immediately discontinue access or use of our Service.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-800 mb-4 pb-2 border-b border-gray-200">2. Information We Collect</h2>
            <div className="space-y-4">
              <p className="text-gray-700 leading-relaxed">
                <strong>2.1 Personal Information:</strong> When you register for an account, we collect information that can be used to identify you, including but not limited to:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-gray-700">
                <li>Full name and contact information (email address, phone number, business address)</li>
                <li>Company information (name, size, industry)</li>
                <li>Billing and payment information (processed through Stripe, we do not store full payment details)</li>
                <li>Account credentials (username, password, security questions)</li>
              </ul>
              
              <p className="text-gray-700 leading-relaxed">
                <strong>2.2 Usage Data:</strong> We automatically collect information about how you interact with our Service, including:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-gray-700">
                <li>IP address, browser type, and device information</li>
                <li>Pages visited, time spent on pages, and navigation paths</li>
                <li>Features used and actions taken within the Service</li>
                <li>Error logs and performance data</li>
              </ul>
              
              <p className="text-gray-700 leading-relaxed">
                <strong>2.3 Cookies and Tracking Technologies:</strong> We use cookies, web beacons, and similar tracking technologies to collect information about your interactions with our Service. You can control the use of cookies at the individual browser level.
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-800 mb-4 pb-2 border-b border-gray-200">3. How We Use Your Information</h2>
            <div className="space-y-4">
              <p className="text-gray-700 leading-relaxed">
                We use the information we collect for various purposes, including to:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-gray-700">
                <li>Provide, operate, and maintain our Service</li>
                <li>Process transactions and send related information, including confirmations and invoices</li>
                <li>Send technical notices, updates, security alerts, and support messages</li>
                <li>Respond to your comments, questions, and requests</li>
                <li>Monitor and analyze trends, usage, and activities in connection with our Service</li>
                <li>Detect, investigate, and prevent fraudulent transactions and other illegal activities</li>
                <li>Personalize and improve the Service and provide content or features that match user profiles or interests</li>
                <li>Comply with legal obligations and protect the rights, property, or safety of SyneraAI, our users, or others</li>
              </ul>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-800 mb-4 pb-2 border-b border-gray-200">4. Data Sharing and Disclosure</h2>
            <div className="space-y-4">
              <p className="text-gray-700 leading-relaxed">
                We may share your information with third parties in the following circumstances:
              </p>
              
              <p className="text-gray-700 leading-relaxed">
                <strong>4.1 Service Providers:</strong> We may employ third-party companies and individuals to facilitate our Service ("Service Providers"), provide the Service on our behalf, perform Service-related services, or assist us in analyzing how our Service is used. These third parties have access to your Personal Information only to perform these tasks on our behalf and are obligated not to disclose or use it for any other purpose.
              </p>
              
              <p className="text-gray-700 leading-relaxed">
                <strong>4.2 Business Transfers:</strong> If we are involved in a merger, acquisition, or asset sale, your Personal Information may be transferred. We will provide notice before your Personal Information is transferred and becomes subject to a different Privacy Policy.
              </p>
              
              <p className="text-gray-700 leading-relaxed">
                <strong>4.3 Legal Requirements:</strong> We may disclose your information if required to do so by law or in response to valid requests by public authorities (e.g., a court or a government agency).
              </p>
              
              <p className="text-gray-700 leading-relaxed">
                <strong>4.4 Protection of Rights:</strong> We may disclose information when we believe in good faith that disclosure is necessary to protect our rights, protect your safety or the safety of others, investigate fraud, or respond to a government request.
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-800 mb-4 pb-2 border-b border-gray-200">5. Data Security</h2>
            <div className="space-y-4">
              <p className="text-gray-700 leading-relaxed">
                We implement appropriate technical and organizational measures to protect the security of your personal information, including:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-gray-700">
                <li>Encryption of data in transit using TLS/SSL protocols</li>
                <li>Regular security assessments and vulnerability testing</li>
                <li>Access controls and authentication mechanisms</li>
                <li>Regular data backups and disaster recovery procedures</li>
                <li>Employee training on data protection and security best practices</li>
              </ul>
              <p className="text-gray-700 leading-relaxed">
                However, no method of transmission over the Internet or method of electronic storage is 100% secure. While we strive to use commercially acceptable means to protect your Personal Information, we cannot guarantee its absolute security.
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-800 mb-4 pb-2 border-b border-gray-200">6. Data Retention</h2>
            <p className="text-gray-700 leading-relaxed">
              We will retain your Personal Information only for as long as is necessary for the purposes set out in this Privacy Policy. We will retain and use your information to the extent necessary to comply with our legal obligations (for example, if we are required to retain your data to comply with applicable laws), resolve disputes, and enforce our legal agreements and policies.
            </p>
            <p className="text-gray-700 leading-relaxed mt-4">
              When we have no ongoing legitimate business need to process your Personal Information, we will either delete or anonymize it, or, if this is not possible (for example, because your Personal Information has been stored in backup archives), then we will securely store your Personal Information and isolate it from any further processing until deletion is possible.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-800 mb-4 pb-2 border-b border-gray-200">7. Your Data Protection Rights</h2>
            <div className="space-y-4">
              <p className="text-gray-700 leading-relaxed">
                Depending on your location, you may have certain rights regarding your personal information, including:
              </p>
              
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold text-gray-800">7.1 Access and Portability</h3>
                  <p className="text-gray-700 leading-relaxed">
                    You have the right to request copies of your personal data. We will provide your data in a structured, commonly used, and machine-readable format.
                  </p>
                </div>
                
                <div>
                  <h3 className="font-semibold text-gray-800">7.2 Rectification</h3>
                  <p className="text-gray-700 leading-relaxed">
                    You have the right to request that we correct any information you believe is inaccurate or complete information you believe is incomplete.
                  </p>
                </div>
                
                <div>
                  <h3 className="font-semibold text-gray-800">7.3 Erasure (Right to be Forgotten)</h3>
                  <p className="text-gray-700 leading-relaxed">
                    You have the right to request that we erase your personal data, under certain conditions.
                  </p>
                </div>
                
                <div>
                  <h3 className="font-semibold text-gray-800">7.4 Restriction of Processing</h3>
                  <p className="text-gray-700 leading-relaxed">
                    You have the right to request that we restrict the processing of your personal data, under certain conditions.
                  </p>
                </div>
                
                <div>
                  <h3 className="font-semibold text-gray-800">7.5 Object to Processing</h3>
                  <p className="text-gray-700 leading-relaxed">
                    You have the right to object to our processing of your personal data, under certain conditions.
                  </p>
                </div>
                
                <div>
                  <h3 className="font-semibold text-gray-800">7.6 Withdraw Consent</h3>
                  <p className="text-gray-700 leading-relaxed">
                    Where we rely on your consent to process your personal information, you have the right to withdraw that consent at any time.
                  </p>
                </div>
              </div>
              
              <p className="text-gray-700 leading-relaxed">
                To exercise any of these rights, please contact us using the information in the "Contact Us" section below. We may need to verify your identity before processing your request.
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-800 mb-4 pb-2 border-b border-gray-200">8. International Data Transfers</h2>
            <p className="text-gray-700 leading-relaxed">
              Your information, including Personal Information, may be transferred to — and maintained on — computers located outside of your state, province, country, or other governmental jurisdiction where the data protection laws may differ from those of your jurisdiction. If you are located outside the United States and choose to provide information to us, please note that we transfer the data, including Personal Information, to the United States and process it there.
            </p>
            <p className="text-gray-700 leading-relaxed mt-4">
              Your consent to this Privacy Policy followed by your submission of such information represents your agreement to that transfer. We will take all steps reasonably necessary to ensure that your data is treated securely and in accordance with this Privacy Policy and no transfer of your Personal Information will take place to an organization or a country unless there are adequate controls in place including the security of your data and other personal information.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-800 mb-4 pb-2 border-b border-gray-200">9. Children's Privacy</h2>
            <p className="text-gray-700 leading-relaxed">
              Our Service is not intended for individuals under the age of 18 ("Children"). We do not knowingly collect personally identifiable information from children under 18. If you are a parent or guardian and you are aware that your child has provided us with Personal Information, please contact us. If we become aware that we have collected Personal Information from children without verification of parental consent, we take steps to remove that information from our servers.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-800 mb-4 pb-2 border-b border-gray-200">10. Changes to This Privacy Policy</h2>
            <p className="text-gray-700 leading-relaxed">
              We may update our Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page and updating the "Effective Date" at the top of this Privacy Policy.
            </p>
            <p className="text-gray-700 leading-relaxed mt-4">
              You are advised to review this Privacy Policy periodically for any changes. Changes to this Privacy Policy are effective when they are posted on this page.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-800 mb-4 pb-2 border-b border-gray-200">11. Contact Us</h2>
            <p className="text-gray-700 leading-relaxed">
              If you have any questions about this Privacy Policy, please contact us:
            </p>
            <address className="not-italic mt-4 space-y-2">
              <p><strong>By email:</strong> privacy@syneraai.com</p>
              <p><strong>By mail:</strong> SyneraAI LLC, 123 Business Avenue, Suite 100, San Francisco, CA 94105, United States</p>
              <p><strong>By phone:</strong> (555) 123-4567</p>
            </address>
            <p className="text-gray-700 leading-relaxed mt-4">
              We will respond to your request within 30 days of receipt. If you are not satisfied with our response, you have the right to lodge a complaint with a data protection authority.
            </p>
          </section>
        </div>

        <div className="mt-12 pt-8 border-t border-gray-200 text-center">
          <a
            href="/company-signup"
            className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 transition-colors duration-200"
          >
            Return to Registration
          </a>
          <p className="mt-4 text-sm text-gray-500">
            Last Updated: June 17, 2025
          </p>
        </div>
      </div>
    </div>
  );
}
