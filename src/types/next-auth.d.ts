import { DefaultSession } from 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      email?: string | null;
      companyCode?: string;
      role?: string;
      tier?: number;
      notificationPreferences?: {
        email: boolean;
        browser: boolean;
        types: {
          system: boolean;
          project: boolean;
          mention: boolean;
          task: boolean;
        };
      };
    } & DefaultSession['user'];
  }

  interface User {
    id: string;
    email?: string | null;
    companyCode?: string;
    role?: string;
    tier?: number;
    notificationPreferences?: {
      email: boolean;
      browser: boolean;
      types: {
        system: boolean;
        project: boolean;
        mention: boolean;
        task: boolean;
      };
    };
  }
}

export type SessionUser = NonNullable<ReturnType<typeof import('next-auth').getServerSession>['user']>;
