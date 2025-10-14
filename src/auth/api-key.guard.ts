import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { IS_PUBLIC_KEY } from './public.decorator';
import type { RequestUser } from './auth-user.interface';
import { FirebaseAdminService } from './firebase-admin.service';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  private readonly allowedKeys: Set<string>;
  private readonly logger = new Logger(ApiKeyGuard.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly reflector: Reflector,
    private readonly firebaseAdminService: FirebaseAdminService,
  ) {
    const rawKeys =
      this.configService.get<string>('API_KEYS') ??
      this.configService.get<string>('API_KEY') ??
      process.env.API_KEYS ??
      process.env.API_KEY ??
      '';

    this.allowedKeys = new Set(
      rawKeys
        .split(',')
        .map((value) => value.trim())
        .filter((value) => value.length > 0),
    );
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request & { authUser?: RequestUser }>();

    // Allow preflight requests to pass without authentication so that CORS works as expected
    if (request.method === 'OPTIONS') {
      return true;
    }

    const firebaseUser = await this.tryAuthorizeWithToken(request);
    if (firebaseUser) {
      request.authUser = firebaseUser;
      return true;
    }

    const providedKey = this.extractKey(request);
    if (providedKey && this.allowedKeys.has(providedKey)) {
      request.authUser = { strategy: 'apiKey' };
      return true;
    }

    throw new UnauthorizedException('Autenticación requerida.');
  }

  private extractKey(request: Request): string | null {
    const headerKey = request.headers['x-api-key'];
    if (typeof headerKey === 'string' && headerKey.length > 0) {
      return headerKey;
    }

    if (Array.isArray(headerKey) && headerKey.length > 0) {
      return headerKey[0];
    }

    return null;
  }

  private async tryAuthorizeWithToken(
    request: Request,
  ): Promise<RequestUser | null> {
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.toLowerCase().startsWith('bearer ')) {
      return null;
    }

    const token = authHeader.slice(7).trim();
    if (!token) {
      return null;
    }

    try {
      const decoded = await this.firebaseAdminService.verifyIdToken(token);
      return {
        strategy: 'firebase',
        uid: decoded.uid,
        email: decoded.email ?? null,
        name: decoded.name ?? null,
        claims: decoded,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Firebase token rejected: ${message}`);
      throw new ForbiddenException('Token inválido o expirado. Volvé a iniciar sesión.');
    }
  }
}
