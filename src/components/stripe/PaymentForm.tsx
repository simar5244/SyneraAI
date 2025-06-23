'use client';

import React, { useEffect } from 'react';
import { PaymentElement, useStripe, useElements, Elements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { toast } from 'react-hot-toast';

export const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '');

interface Props {
  clientSecret: string;
  onPaymentSuccess: (paymentMethodId?: string) => void;
  onPaymentError: (error: string) => void;
}

const CheckoutForm = ({ onPaymentSuccess, onPaymentError }: Omit<Props, 'clientSecret'>) => {
  const stripe = useStripe();
  const elements = useElements();
  const [isLoading, setIsLoading] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setIsLoading(true);
    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      redirect: 'if_required',
      confirmParams: { return_url: window.location.origin + '/payment-success' },
    });
    if (error) {
      toast.error(error.message || 'Payment failed');
      onPaymentError(error.message || 'Payment failed');
    } else {
      // Get the payment method ID from the payment intent
      const paymentMethodId = paymentIntent?.payment_method as string;
      onPaymentSuccess(paymentMethodId);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    // Check for async payment result after redirect
    const params = new URLSearchParams(window.location.search);
    const clientSecretParam = params.get('payment_intent_client_secret');
    if (!clientSecretParam) return;
    stripePromise.then(stripe => {
      if (!stripe) return;
      stripe.retrievePaymentIntent(clientSecretParam).then(({ paymentIntent }) => {
        if (paymentIntent?.status === 'succeeded' || paymentIntent?.status === 'requires_capture') {
          toast.success('Payment successful');
          // Get the payment method ID from the payment intent
          const paymentMethodId = paymentIntent?.payment_method as string;
          onPaymentSuccess(paymentMethodId);
        } else if (paymentIntent && paymentIntent.status !== 'requires_action') {
          toast.error('Payment failed');
          onPaymentError('Payment failed');
        }
      });
    });
  }, []);

  return (
    <form onSubmit={handleSubmit} className="w-full">
      <div className="mb-2 border border-gray-300 rounded p-2">
        <PaymentElement />
      </div>
      <button
        type="submit"
        disabled={!stripe || isLoading}
        className="w-full py-1.5 px-3 text-sm rounded-md font-medium text-white bg-purple-600 hover:bg-purple-700 disabled:opacity-50"
      >
        {isLoading ? 'Processing...' : 'Pay Now'}
      </button>
    </form>
  );
};

export default function PaymentForm({ clientSecret, onPaymentSuccess, onPaymentError }: Props) {
  if (!clientSecret) return null;
  return (
    <Elements stripe={stripePromise} options={{ clientSecret }}>
      <CheckoutForm onPaymentSuccess={onPaymentSuccess} onPaymentError={onPaymentError} />
    </Elements>
  );
}

