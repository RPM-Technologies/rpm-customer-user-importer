import 'express-session';

declare module 'express-session' {
  interface SessionData {
    passport?: {
      user?: any;
    };
  }
}

declare global {
  namespace Express {
    interface User {
      id: number;
      openId: string;
      name?: string | null;
      email?: string | null;
      role: string;
    }
  }
}
