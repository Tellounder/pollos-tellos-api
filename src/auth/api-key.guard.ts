import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { IS_PUBLIC_KEY } from './public.decorator';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  private readonly allowedKeys: Set<string>;

  constructor(private readonly configService: ConfigService, private readonly reflector: Reflector) {
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

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    if (this.allowedKeys.size === 0) {
      throw new UnauthorizedException('API key no configurada en el servidor');
    }

    const request = context.switchToHttp().getRequest<Request>();
    const providedKey = this.extractKey(request);

    if (!providedKey || !this.allowedKeys.has(providedKey)) {
      throw new UnauthorizedException('API key inválida o ausente');
    }

    return true;
  }

  private extractKey(request: Request): string | null {
    const headerKey = request.headers['x-api-key'];
    if (typeof headerKey === 'string' && headerKey.length > 0) {
      return headerKey;
    }

    if (Array.isArray(headerKey) && headerKey.length > 0) {
      return headerKey[0];
    }

    const authHeader = request.headers.authorization;
    if (authHeader && authHeader.toLowerCase().startsWith('bearer ')) {
      return authHeader.slice(7).trim();
    }

    return null;
  }
}
