import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { App, applicationDefault, cert, getApp, getApps, initializeApp } from 'firebase-admin/app';
import { Auth, DecodedIdToken, getAuth } from 'firebase-admin/auth';

@Injectable()
export class FirebaseAdminService {
  private readonly logger = new Logger(FirebaseAdminService.name);
  private app: App | null = null;
  private auth: Auth | null = null;

  private readonly projectId: string | undefined;
  private readonly clientEmail: string | undefined;
  private readonly privateKey: string | undefined;

  constructor(private readonly configService: ConfigService) {
    const serviceAccountJson = this.configService.get<string>('FIREBASE_SERVICE_ACCOUNT_JSON');

    if (serviceAccountJson) {
      try {
        const parsed = JSON.parse(serviceAccountJson);
        this.projectId = parsed.project_id;
        this.clientEmail = parsed.client_email;
        this.privateKey = typeof parsed.private_key === 'string' ? parsed.private_key.replace(/\\n/g, '\n') : undefined;
      } catch (error) {
        this.logger.error('Invalid FIREBASE_SERVICE_ACCOUNT_JSON', error instanceof Error ? error.message : error);
      }
    } else {
      this.projectId = this.configService.get<string>('FIREBASE_PROJECT_ID');
      this.clientEmail = this.configService.get<string>('FIREBASE_CLIENT_EMAIL');
      const rawKey = this.configService.get<string>('FIREBASE_PRIVATE_KEY');
      this.privateKey = rawKey ? rawKey.replace(/\\n/g, '\n') : undefined;
    }
  }

  private getFirebaseApp(): App {
    if (this.app) {
      return this.app;
    }

    if (getApps().length > 0) {
      this.app = getApp();
      return this.app;
    }

    try {
      if (this.privateKey && this.clientEmail) {
        this.app = initializeApp({
          credential: cert({
            projectId: this.projectId,
            clientEmail: this.clientEmail,
            privateKey: this.privateKey,
          }),
          projectId: this.projectId,
        });
      } else {
        this.app = initializeApp({
          credential: applicationDefault(),
          projectId: this.projectId ?? undefined,
        });
      }
    } catch (error) {
      this.logger.error('Failed to initialize Firebase Admin SDK', error instanceof Error ? error.stack : error);
      throw error;
    }

    return this.app;
  }

  private getAuth(): Auth {
    if (!this.auth) {
      const app = this.getFirebaseApp();
      this.auth = getAuth(app);
    }
    return this.auth;
  }

  async verifyIdToken(token: string): Promise<DecodedIdToken> {
    const auth = this.getAuth();
    return auth.verifyIdToken(token, true);
  }
}
