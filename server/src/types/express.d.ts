declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        username: string;
        email: string;
        displayName: string | null;
        avatarUrl: string | null;
        createdAt: Date;
      };
    }
  }
}

export {};
