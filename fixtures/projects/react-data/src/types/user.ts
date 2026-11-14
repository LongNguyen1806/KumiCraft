export interface UserInput {
  fullName: string;
  email: string;
  role: 'admin' | 'member';
  active: boolean;
}
