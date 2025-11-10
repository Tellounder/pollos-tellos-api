import { Injectable, Logger } from '@nestjs/common';
import type { RequestUser } from '../auth/auth-user.interface';
import { PrismaService } from '../prisma/prisma.service';
import type { Prisma } from '@prisma/client';

type DesignRecord = {
  key: string;
  data: Prisma.JsonValue;
  updated_at: Date;
  updated_by: string | null;
};

@Injectable()
export class DesignService {
  private readonly logger = new Logger(DesignService.name);
  private ensureTablePromise: Promise<void> | null = null;

  constructor(private readonly prisma: PrismaService) {}

  private ensureTableExists(): Promise<void> {
    if (!this.ensureTablePromise) {
      this.ensureTablePromise = this.prisma
        .$executeRaw`CREATE TABLE IF NOT EXISTS design_content (
            key text PRIMARY KEY,
            data jsonb NOT NULL DEFAULT '{}'::jsonb,
            updated_at timestamptz NOT NULL DEFAULT now(),
            updated_by text
          )`
        .then(() => undefined)
        .catch((error) => {
          this.logger.error('Failed to ensure design_content table exists', error instanceof Error ? error.stack : String(error));
          throw error;
        });
    }
    return this.ensureTablePromise;
  }

  async getContent(key = 'home') {
    await this.ensureTableExists();
    const rows = (await this.prisma.$queryRaw`SELECT key, data, updated_at, updated_by FROM design_content WHERE key = ${key} LIMIT 1`) as DesignRecord[];
    const record = rows[0];

    return {
      key,
      data: (record?.data as Record<string, unknown>) ?? {},
      updatedAt: record?.updated_at ?? null,
      updatedBy: record?.updated_by ?? null,
    };
  }

  async saveContent(data: Record<string, unknown>, user?: RequestUser | null, key = 'home') {
    await this.ensureTableExists();
    const updatedBy = this.resolveUpdatedBy(user);
    await this.prisma.$executeRaw`INSERT INTO design_content (key, data, updated_by)
        VALUES (${key}, ${data as Prisma.JsonObject}, ${updatedBy})
        ON CONFLICT (key)
        DO UPDATE SET data = EXCLUDED.data,
                      updated_by = EXCLUDED.updated_by,
                      updated_at = now();`;

    return this.getContent(key);
  }

  private resolveUpdatedBy(user?: RequestUser | null) {
    if (!user) {
      return null;
    }
    if (user.email) {
      return user.email;
    }
    if (user.name) {
      return user.name;
    }
    if (user.uid) {
      return `uid:${user.uid}`;
    }
    return user.strategy ?? null;
  }
}
