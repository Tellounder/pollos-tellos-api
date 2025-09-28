import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, AuthProvider, OrderStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateUserDto } from '../dto/create-user.dto';
import { UpdateUserDto } from '../dto/update-user.dto';
import { UpdateProfileDto } from '../dto/update-profile.dto';

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
        discountRedemptions: true,
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

    const updatedUser = await this.prisma.user.update({
      where: { id },
      data: userData,
    });

    if (address) {
      const existingPrimary = await this.prisma.address.findFirst({
        where: { userId: id, isPrimary: true },
      });

      if (existingPrimary) {
        await this.prisma.address.update({
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
      } else {
        await this.prisma.address.create({
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
      }
    }

    return this.findOne(id);
  }

  async deactivate(id: string) {
    await this.ensureExists(id);
    return this.prisma.user.update({
      where: { id },
      data: { isActive: false },
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
      lifetimeOrders: lifetimeOrders._count,
      lifetimeNetSales: lifetimeOrders._sum.totalNet?.toString() ?? '0',
      lastOrderAt: lifetimeOrders._max.placedAt,
      shareEvents,
      loyaltyEvents,
      referralProfile,
      discountUsage,
      qualifiesForBonus: monthlyOrders >= 3,
    };
  }

  private async ensureExists(id: string) {
    const exists = await this.prisma.user.count({ where: { id } });
    if (!exists) {
      throw new NotFoundException(`Usuario ${id} no encontrado.`);
    }
  }
}
