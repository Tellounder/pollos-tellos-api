export type AuthStrategy = 'firebase' | 'apiKey';

export type RequestUser = {
  strategy: AuthStrategy;
  uid?: string;
  email?: string | null;
  name?: string | null;
  claims?: Record<string, unknown>;
};
