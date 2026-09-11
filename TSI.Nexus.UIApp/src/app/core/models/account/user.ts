export interface User {
  id: string;
  userName: string;
  email: string;
  emailConfirmed: boolean;
  firstName: string;
  lastName: string;
  // The JWT itself never reaches the client - it travels in an httpOnly cookie the server sets.
  // This is only the expiry, so the app can schedule its own renewal/auto-logout timer.
  tokenExpiresAtUtc: string | null;
  photo: string;
  role?: string;
  roles?: string[];
  theme?: string | null;
  language?: string | null;
  createDate?: Date;
  createUserId?: string | null;
  modifyDate?: Date | null;
  modifyUserId?: string | null;
}
