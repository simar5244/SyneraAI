import '../src/app/globals.css';
import type { AppProps } from 'next/app';
import RootLayout from '../src/app/layout';

console.log('[App] _app.tsx loaded');

export default function MyApp({ Component, pageProps }: AppProps) {
  return (
    <RootLayout>
      <Component {...pageProps} />
    </RootLayout>
  );
}
