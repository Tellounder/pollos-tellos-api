import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../prisma/prisma.service';
import { UsersService } from './users.service';

describe('UsersService', () => {
  let service: UsersService;

  beforeEach(async () => {
    const prismaMock = {
      user: {
        create: jest.fn().mockResolvedValue({}),
        upsert: jest.fn().mockResolvedValue({}),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        findUnique: jest.fn().mockResolvedValue(null),
        update: jest.fn().mockResolvedValue({}),
      },
      address: {
        findFirst: jest.fn().mockResolvedValue(null),
        update: jest.fn().mockResolvedValue({}),
        create: jest.fn().mockResolvedValue({}),
      },
      order: {
        count: jest.fn().mockResolvedValue(0),
        aggregate: jest
          .fn()
          .mockResolvedValue({ _count: 0, _sum: { totalNet: 0 }, _max: { placedAt: null } }),
      },
      referralShare: { count: jest.fn().mockResolvedValue(0) },
      loyaltyEvent: { count: jest.fn().mockResolvedValue(0) },
      referral: { findUnique: jest.fn().mockResolvedValue(null) },
      discountRedemption: { count: jest.fn().mockResolvedValue(0) },
      $transaction: jest.fn().mockImplementation(async (actions: any[]) => Promise.all(actions)),
    } satisfies Partial<PrismaService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [UsersService, { provide: PrismaService, useValue: prismaMock }],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
