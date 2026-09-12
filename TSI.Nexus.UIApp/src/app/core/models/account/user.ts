export interface User {
  id: string;
  userName: string;
  email: string;
  emailConfirmed: boolean;
  firstName: string;
  lastName: string;
  jwt: string;
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
