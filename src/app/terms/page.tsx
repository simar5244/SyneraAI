'use client';

import React from 'react';
import Link from 'next/link';

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-gradient-to-r from-purple-50 to-pink-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto bg-white rounded-xl shadow-lg overflow-hidden p-8">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Terms of Service</h1>
          <p className="text-lg text-gray-600">Effective Date: June 17, 2025</p>
        </div>

        <div className="prose max-w-none space-y-8">
          <section>
            <h2 className="text-2xl font-bold text-gray-800 mb-4 pb-2 border-b border-gray-200">1. Agreement to Terms</h2>
            <p className="text-gray-700 leading-relaxed">
              These Terms of Service ("Terms") constitute a legally binding agreement between you ("User," "you," or "your") and SyneraAI LLC ("Company," "we," "us," or "our") governing your access to and use of the SyneraAI platform, including any related applications, services, and tools (collectively, the "Service"). By accessing or using the Service, you acknowledge that you have read, understood, and agree to be bound by these Terms. If you do not agree with any part of these Terms, you must not access or use the Service.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-800 mb-4 pb-2 border-b border-gray-200">2. Service Description</h2>
            <p className="text-gray-700 leading-relaxed">
              SyneraAI provides a cloud-based business management platform that enables companies to streamline operations, manage users, and process payments through integrated third-party services including Stripe. The Service includes features for user management, subscription handling, and administrative controls, accessible through our web application and associated APIs.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-800 mb-4 pb-2 border-b border-gray-200">3. Account Registration and Security</h2>
            <div className="space-y-4">
              <p className="text-gray-700 leading-relaxed">
                <strong>3.1 Eligibility:</strong> To use the Service, you must be at least 18 years of age and have the legal capacity to enter into these Terms. By creating an account, you represent and warrant that you meet these requirements.
              </p>
              <p className="text-gray-700 leading-relaxed">
                <strong>3.2 Account Creation:</strong> When registering for an account, you agree to provide accurate, current, and complete information. You are solely responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account.
              </p>
              <p className="text-gray-700 leading-relaxed">
                <strong>3.3 Security:</strong> You must immediately notify us of any unauthorized use of your account or any other security breach. We reserve the right to suspend or terminate your account if we suspect any unauthorized access or violation of these Terms.
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-800 mb-4 pb-2 border-b border-gray-200">4. Subscription and Billing</h2>
            <div className="space-y-4">
              <p className="text-gray-700 leading-relaxed">
                <strong>4.1 Subscription Plans:</strong> The Service is offered under various subscription tiers, each with specific features and user limits. You may upgrade, downgrade, or cancel your subscription through the Service's dashboard.
              </p>
              <p className="text-gray-700 leading-relaxed">
                <strong>4.2 Payment Processing:</strong> All payments are processed through Stripe, our third-party payment processor. By providing payment information, you authorize us to charge the applicable fees to your chosen payment method.
              </p>
              <p className="text-gray-700 leading-relaxed">
                <strong>4.3 Billing Cycle:</strong> Subscription fees are billed in advance on a monthly or annual basis, as selected during registration. The billing cycle begins on the date of initial subscription and automatically renews unless canceled before the renewal date.
              </p>
              <p className="text-gray-700 leading-relaxed">
                <strong>4.4 Refunds:</strong> All fees are non-refundable except as required by law. We do not provide refunds or credits for partial subscription periods or unused features.
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-800 mb-4 pb-2 border-b border-gray-200">5. Data Protection and Privacy</h2>
            <p className="text-gray-700 leading-relaxed">
              Your privacy is important to us. Our collection, use, and disclosure of personal information are governed by our <Link href="/privacy" className="text-purple-600 hover:text-purple-800 font-medium">Privacy Policy</Link>, which is incorporated by reference into these Terms. By using the Service, you consent to our data practices as described in the Privacy Policy.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-800 mb-4 pb-2 border-b border-gray-200">6. User Content and Conduct</h2>
            <div className="space-y-4">
              <p className="text-gray-700 leading-relaxed">
                <strong>6.1 User Content:</strong> You retain ownership of all content you submit to the Service ("User Content"). By submitting User Content, you grant us a worldwide, non-exclusive, royalty-free license to use, reproduce, modify, and display such content for the purpose of providing the Service.
              </p>
              <p className="text-gray-700 leading-relaxed">
                <strong>6.2 Prohibited Conduct:</strong> You agree not to use the Service to:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-gray-700">
                <li>Violate any applicable laws or regulations</li>
                <li>Infringe upon the intellectual property rights of others</li>
                <li>Transmit viruses, malware, or other harmful code</li>
                <li>Interfere with or disrupt the integrity or performance of the Service</li>
                <li>Attempt to gain unauthorized access to any portion of the Service</li>
              </ul>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-800 mb-4 pb-2 border-b border-gray-200">7. Intellectual Property</h2>
            <p className="text-gray-700 leading-relaxed">
              The Service and its original content, features, and functionality are and will remain the exclusive property of SyneraAI LLC and its licensors. The Service is protected by copyright, trademark, and other laws of both the United States and foreign countries. Our trademarks and trade dress may not be used in connection with any product or service without our prior written consent.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-800 mb-4 pb-2 border-b border-gray-200">8. Limitation of Liability</h2>
            <p className="text-gray-700 leading-relaxed">
              TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, IN NO EVENT SHALL SYNERA AI LLC, ITS AFFILIATES, DIRECTORS, EMPLOYEES, OR LICENSORS BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING BUT NOT LIMITED TO LOSS OF PROFITS, DATA, USE, GOODWILL, OR OTHER INTANGIBLE LOSSES, RESULTING FROM (I) YOUR ACCESS TO OR USE OF OR INABILITY TO ACCESS OR USE THE SERVICE; (II) ANY CONDUCT OR CONTENT OF ANY THIRD PARTY ON THE SERVICE; (III) ANY CONTENT OBTAINED FROM THE SERVICE; OR (IV) UNAUTHORIZED ACCESS, USE, OR ALTERATION OF YOUR TRANSMISSIONS OR CONTENT.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-800 mb-4 pb-2 border-b border-gray-200">9. Indemnification</h2>
            <p className="text-gray-700 leading-relaxed">
              You agree to defend, indemnify, and hold harmless SyneraAI LLC and its affiliates, officers, directors, employees, and agents from and against any and all claims, damages, obligations, losses, liabilities, costs, or debt, and expenses (including but not limited to attorney's fees) arising from: (i) your use of and access to the Service; (ii) your violation of any term of these Terms; (iii) your violation of any third-party right, including without limitation any copyright, property, or privacy right; or (iv) any claim that your User Content caused damage to a third party.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-800 mb-4 pb-2 border-b border-gray-200">10. Termination</h2>
            <p className="text-gray-700 leading-relaxed">
              We may terminate or suspend your account and bar access to the Service immediately, without prior notice or liability, under our sole discretion, for any reason whatsoever and without limitation, including but not limited to a breach of these Terms. Upon termination, your right to use the Service will immediately cease. All provisions of these Terms which by their nature should survive termination shall survive termination, including, without limitation, ownership provisions, warranty disclaimers, indemnity, and limitations of liability.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-800 mb-4 pb-2 border-b border-gray-200">11. Governing Law</h2>
            <p className="text-gray-700 leading-relaxed">
              These Terms shall be governed and construed in accordance with the laws of the State of Delaware, United States, without regard to its conflict of law provisions. Any dispute arising out of or relating to these Terms or the Service shall be exclusively submitted to the state and federal courts located in Delaware, and you consent to the personal jurisdiction of such courts.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-800 mb-4 pb-2 border-b border-gray-200">12. Changes to Terms</h2>
            <p className="text-gray-700 leading-relaxed">
              We reserve the right, at our sole discretion, to modify or replace these Terms at any time. We will provide at least 30 days' notice prior to any new terms taking effect. What constitutes a material change will be determined at our sole discretion. By continuing to access or use our Service after those revisions become effective, you agree to be bound by the revised terms.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-800 mb-4 pb-2 border-b border-gray-200">13. Contact Information</h2>
            <p className="text-gray-700 leading-relaxed">
              If you have any questions about these Terms, please contact us at:
            </p>
            <address className="not-italic mt-2">
              SyneraAI LLC<br />
              123 Business Avenue, Suite 100<br />
              San Francisco, CA 94105<br />
              Email: legal@syneraai.com<br />
              Phone: (555) 123-4567
            </address>
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
            By using our services, you acknowledge that you have read and agree to these Terms of Service.
          </p>
        </div>
      </div>
    </div>
  );
}
