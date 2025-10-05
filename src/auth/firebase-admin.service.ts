import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { App, applicationDefault, cert, getApp, getApps, initializeApp } from 'firebase-admin/app';
import { Auth, DecodedIdToken, getAuth } from 'firebase-admin/auth';

@Injectable()
export class FirebaseAdminService {
  private readonly logger = new Logger(FirebaseAdminService.name);
  private app: App | null = null;
  private auth: Auth | null = null;

  constructor(private readonly configService: ConfigService) {}

  private getFirebaseApp(): App {
    if (this.app) {
      return this.app;
    }

    if (getApps().length > 0) {
      this.app = getApp();
      return this.app;
    }

    const serviceAccountJson = this.configService.get<string>('FIREBASE_SERVICE_ACCOUNT_JSON');
    const projectId = this.configService.get<string>('FIREBASE_PROJECT_ID');

    try {
      if (serviceAccountJson) {
        const parsed = JSON.parse(serviceAccountJson);
        const privateKey = typeof parsed.private_key === 'string' ? parsed.private_key.replace(/\\n/g, '\n') : undefined;

        this.app = initializeApp({
          credential: cert({
            projectId: parsed.project_id ?? projectId,
            clientEmail: parsed.client_email,
            privateKey,
          }),
          projectId: parsed.project_id ?? projectId,
        });
      } else {
        this.app = initializeApp({
          credential: applicationDefault(),
          projectId: projectId ?? undefined,
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
