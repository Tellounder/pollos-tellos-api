import { randomBytes } from 'crypto';
import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
  Prisma,
  AuthProvider,
  OrderStatus,
  ShareCoupon,
  ShareCouponStatus,
  DiscountType,
  DiscountScope,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateUserDto } from '../dto/create-user.dto';
import { UpdateUserDto } from '../dto/update-user.dto';
import { UpdateProfileDto } from '../dto/update-profile.dto';
import { CreateUserDiscountDto } from '../dto/create-user-discount.dto';

export type UsersQuery = {
  skip?: number;
  take?: number;
  search?: string;
  activeOnly?: boolean;
};

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createUserDto: CreateUserDto) {
    const { email, externalAuthId, termsAcceptedAt, ...rest } = createUserDto;

    return this.prisma.user.upsert({
      where: { email },
      create: {
        email,
        externalAuthId,
        authProvider: rest.authProvider ?? AuthProvider.FIREBASE,
        phone: rest.phone,
        firstName: rest.firstName,
        lastName: rest.lastName,
        displayName: rest.displayName,
        termsAcceptedAt: termsAcceptedAt ? new Date(termsAcceptedAt) : undefined,
      },
      update: {
        externalAuthId: externalAuthId ?? undefined,
        authProvider: rest.authProvider ?? undefined,
        phone: rest.phone ?? undefined,
        firstName: rest.firstName ?? undefined,
        lastName: rest.lastName ?? undefined,
        displayName: rest.displayName ?? undefined,
        isActive: true,
        termsAcceptedAt: termsAcceptedAt ? new Date(termsAcceptedAt) : undefined,
      },
    });
  }

  async findAll({ skip = 0, take = 25, search, activeOnly }: UsersQuery = {}) {
    const where: Prisma.UserWhereInput = {};

    if (search) {
      const term = search.trim();
      where.OR = [
        { email: { contains: term, mode: 'insensitive' } },
        { firstName: { contains: term, mode: 'insensitive' } },
        { lastName: { contains: term, mode: 'insensitive' } },
        { displayName: { contains: term, mode: 'insensitive' } },
        { phone: { contains: term, mode: 'insensitive' } },
      ];
    }

    if (activeOnly) {
      where.isActive = true;
    }

    const [items, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        skip,
        take,
        where,
        orderBy: { createdAt: 'desc' },
        include: {
          addresses: true,
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    return { items, total, skip, take };
  }

  async findOne(id: string) {
    await this.ensureExists(id);
    await this.ensureMonthlyShareCoupons(id).catch(() => undefined);

    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        addresses: true,
        orders: {
          orderBy: { placedAt: 'desc' },
          take: 5,
        },
        referralProfile: {
          include: {
            invites: {
              include: {
                shareEvents: true,
                invitedUser: {
                  select: {
                    id: true,
                    email: true,
                    firstName: true,
                    lastName: true,
                  },
                },
              },
            },
          },
        },
        discountCodesCreated: {
          include: { redemptions: true },
        },
        discountCodesOwned: {
          include: { redemptions: true },
        },
        discountRedemptions: {
          include: {
            code: true,
            order: {
              select: { id: true, number: true, placedAt: true },
            },
          },
        },
        shareCoupons: {
          orderBy: [{ year: 'desc' }, { month: 'desc' }, { createdAt: 'asc' }],
        },
      },
    });

    if (!user) {
      throw new NotFoundException(`Usuario ${id} no encontrado.`);
    }

    return user;
  }

  async update(id: string, updateUserDto: UpdateUserDto) {
    await this.ensureExists(id);
    return this.prisma.user.update({
      where: { id },
      data: updateUserDto,
    });
  }

  async updateProfile(id: string, payload: UpdateProfileDto) {
    await this.ensureExists(id);

    const { address, ...userData } = payload;

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id },
        data: userData,
      });

      if (!address) {
        return;
      }

      const existingPrimary = await tx.address.findFirst({
        where: { userId: id, isPrimary: true },
      });

      if (existingPrimary) {
        await tx.address.update({
          where: { id: existingPrimary.id },
          data: {
            label: address.label ?? existingPrimary.label,
            line1: address.line1,
            line2: address.line2 ?? null,
            city: address.city ?? existingPrimary.city,
            province: address.province ?? existingPrimary.province,
            postalCode: address.postalCode ?? existingPrimary.postalCode,
            notes: address.notes ?? existingPrimary.notes,
            isPrimary: true,
          },
        });
        return;
      }

      await tx.address.create({
        data: {
          userId: id,
          label: address.label ?? 'Principal',
          line1: address.line1,
          line2: address.line2,
          city: address.city ?? 'Sin especificar',
          province: address.province,
          postalCode: address.postalCode,
          notes: address.notes,
          isPrimary: true,
        },
      });
    });

    return this.findOne(id);
  }

  async deactivate(id: string) {
    await this.ensureExists(id);
    return this.prisma.user.update({
      where: { id },
      data: { isActive: false },
    });
  }

  async ensureBelongsToEmail(id: string, email: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true, email: true },
    });

    if (!user) {
      throw new NotFoundException(`Usuario ${id} no encontrado.`);
    }

    if (user.email.toLowerCase() !== email.toLowerCase()) {
      throw new ForbiddenException('No tenés permiso para operar con esta cuenta.');
    }

    return user;
  }

  async registerPurchase(id: string) {
    await this.ensureExists(id);
    return this.prisma.$transaction(async (tx) => {
      await tx.purchase.create({ data: { userId: id } });
      const totalPurchases = await tx.purchase.count({ where: { userId: id } });
      const modulo = totalPurchases % 7;
      const unlockBonus = modulo === 0 || modulo === 3;

      return {
        totalPurchases,
        unlockBonus,
      };
    });
  }

  async getEngagementSnapshot(id: string) {
    await this.ensureExists(id);

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [monthlyOrders, lifetimeOrders, shareEvents, loyaltyEvents, referralProfile, discountUsage] =
      await Promise.all([
        this.prisma.order.count({
          where: {
            userId: id,
            placedAt: { gte: startOfMonth },
            status: { in: [OrderStatus.CONFIRMED, OrderStatus.FULFILLED] },
          },
        }),
        this.prisma.order.aggregate({
          where: {
            userId: id,
            status: { in: [OrderStatus.CONFIRMED, OrderStatus.FULFILLED] },
          },
          _count: true,
          _sum: { totalNet: true },
          _max: { placedAt: true },
        }),
        this.prisma.referralShare.count({ where: { userId: id } }),
        this.prisma.loyaltyEvent.count({ where: { userId: id } }),
        this.prisma.referralProfile.findUnique({
          where: { userId: id },
          include: {
            invites: {
              include: {
                shareEvents: true,
                invitedUser: {
                  select: { id: true, email: true, firstName: true, lastName: true },
                },
              },
            },
          },
        }),
        this.prisma.discountRedemption.count({ where: { userId: id } }),
      ]);

    return {
      monthlyOrders,
      lifetimeOrders: lifetimeOrders._count ?? 0,
      lifetimeNetSales: lifetimeOrders._sum.totalNet?.toString() ?? '0',
      lastOrderAt: lifetimeOrders._max.placedAt ?? null,
      shareEvents,
      loyaltyEvents,
      referralProfile: referralProfile ?? null,
      discountUsage,
      qualifiesForBonus: monthlyOrders >= 3,
    };
  }

  async listShareCoupons(id: string) {
    await this.ensureExists(id);
    return this.prisma.shareCoupon.findMany({
      where: { userId: id },
      orderBy: [{ year: 'desc' }, { month: 'desc' }, { createdAt: 'asc' }],
    });
  }

  async activateShareCoupon(id: string, code: string) {
    await this.ensureExists(id);
    const coupon = await this.prisma.shareCoupon.findFirst({
      where: { userId: id, code },
    });

    if (!coupon) {
      throw new NotFoundException(`Cupón ${code} no encontrado.`);
    }

    if (coupon.status === ShareCouponStatus.ACTIVATED || coupon.status === ShareCouponStatus.REDEEMED) {
      return coupon;
    }

    return this.prisma.shareCoupon.update({
      where: { id: coupon.id },
      data: {
        status: ShareCouponStatus.ACTIVATED,
        activatedAt: new Date(),
      },
    });
  }

  async ensureMonthlyShareCoupons(userId: string, referenceDate = new Date()) {
    await this.ensureExists(userId);
    const month = referenceDate.getMonth() + 1;
    const year = referenceDate.getFullYear();

    const existing = await this.prisma.shareCoupon.findMany({
      where: { userId, month, year },
      orderBy: { createdAt: 'asc' },
    });

    if (existing.length >= 3) {
      return existing;
    }

    const needed = 3 - existing.length;
    const created: ShareCoupon[] = [];

    await this.prisma.$transaction(async (tx) => {
      for (let i = 0; i < needed; i += 1) {
        let code: string | null = null;
        for (let attempt = 0; attempt < 10; attempt += 1) {
          const candidate = this.buildShareCouponCode(year, month);
          const conflict = await tx.shareCoupon.findUnique({ where: { code: candidate } });
          if (!conflict) {
            code = candidate;
            break;
          }
        }

        if (!code) {
          throw new Error('No se pudo generar un código de referidos único.');
        }

        const coupon = await tx.shareCoupon.create({
          data: {
            userId,
            code,
            month,
            year,
            status: ShareCouponStatus.ISSUED,
          },
        });
        created.push(coupon);
      }
    });

    return [...existing, ...created];
  }

  async listShareCouponsGlobal(status?: ShareCouponStatus) {
    const where: Prisma.ShareCouponWhereInput = {};
    if (status) {
      where.status = status;
    }

    return this.prisma.shareCoupon.findMany({
      where,
      orderBy: [{ year: 'desc' }, { month: 'desc' }, { createdAt: 'desc' }],
      include: {
        user: {
          select: {
            id: true,
            email: true,
            displayName: true,
          },
        },
      },
    });
  }

  async grantDiscount(id: string, payload: CreateUserDiscountDto) {
    await this.ensureExists(id);

    if (!payload.value || payload.value <= 0) {
      throw new BadRequestException('El valor del descuento debe ser mayor a 0.');
    }

    const code = this.buildDiscountCode();
    const expiresAt = payload.expiresAt ? new Date(payload.expiresAt) : undefined;

    return this.prisma.discountCode.create({
      data: {
        code,
        type: DiscountType.COMPENSATION,
        scope: DiscountScope.ORDER,
        value: new Prisma.Decimal(payload.value),
        percentage: null,
        maxRedemptions: 1,
        expiresAt: expiresAt ?? null,
        metadata: payload.label ? { label: payload.label } : undefined,
        owner: { connect: { id } },
      },
      include: { redemptions: true },
    });
  }

  async listDiscountCodes({ activeOnly = false }: { activeOnly?: boolean } = {}) {
    const where: Prisma.DiscountCodeWhereInput = {};

    if (activeOnly) {
      const now = new Date();
      where.AND = [
        {
          OR: [{ expiresAt: null }, { expiresAt: { gte: now } }],
        },
        {
          redemptions: {
            none: {},
          },
        },
      ];
    }

    return this.prisma.discountCode.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        owner: {
          select: {
            id: true,
            email: true,
            displayName: true,
          },
        },
        redemptions: true,
      },
    });
  }

  private async ensureExists(id: string) {
    const exists = await this.prisma.user.count({ where: { id } });
    if (!exists) {
      throw new NotFoundException(`Usuario ${id} no encontrado.`);
    }
  }

  private buildShareCouponCode(year: number, month: number) {
    const suffix = randomBytes(3).toString('hex').toUpperCase();
    const yearPart = (year % 100).toString().padStart(2, '0');
    const monthPart = month.toString().padStart(2, '0');
    return `TELLO${yearPart}${monthPart}-${suffix}`;
  }

  private buildDiscountCode() {
    return `TELLOS-${randomBytes(3).toString('hex').toUpperCase()}`;
  }
}
