import { ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { RequestUser } from './auth-user.interface';

@Injectable()
export class AuthzService {
  private readonly adminEmails: Set<string>;

  constructor(private readonly configService: ConfigService) {
    const raw =
      this.configService.get<string>('ADMIN_EMAILS') ??
      this.configService.get<string>('ADMIN_EMAIL') ??
      'pollostellos.arg@gmail.com';

    this.adminEmails = new Set(
      raw
        .split(',')
        .map((value) => value.trim().toLowerCase())
        .filter((value) => value.length > 0),
    );
  }

  isAdmin(user: RequestUser | null): boolean {
    if (!user || user.strategy !== 'firebase') {
      return false;
    }
    const email = user.email?.toLowerCase();
    if (!email) {
      return false;
    }
    return this.adminEmails.has(email);
  }

  ensureAuthenticated(user: RequestUser | null) {
    if (!user || user.strategy !== 'firebase') {
      throw new ForbiddenException('Se requiere iniciar sesión.');
    }
  }

  ensureAdmin(user: RequestUser | null) {
    this.ensureAuthenticated(user);
    if (!this.isAdmin(user)) {
      throw new ForbiddenException('No tenés permisos para esta operación.');
    }
  }

  ensureEmailMatch(user: RequestUser | null, email: string) {
    this.ensureAuthenticated(user);
    if (!user?.email || user.email.toLowerCase() !== email.toLowerCase()) {
      throw new ForbiddenException('No podés operar sobre este recurso.');
    }
  }
}
