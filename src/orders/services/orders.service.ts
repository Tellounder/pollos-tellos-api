import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { OrderStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateOrderDto } from '../dto/create-order.dto';
import { UpdateOrderStatusDto } from '../dto/update-order-status.dto';

type OrderSelect = {
  id: true;
  number: true;
  status: true;
  totalGross: true;
  totalNet: true;
  discountTotal: true;
  metadata: true;
  whatsappLink: true;
  userId: true;
  createdAt: true;
  updatedAt: true;
  placedAt: true;
  confirmedAt: true;
  cancelledAt: true;
  cancellationReason: true;
  note: true;
};

type OrderPayload = Prisma.OrderGetPayload<{ select: OrderSelect }>;

interface FindAllParams {
  status?: OrderStatus;
  skip?: number;
  take?: number;
  userId?: string;
}

@Injectable()
export class OrdersService {
  private readonly baseSelect: OrderSelect = {
    id: true,
    number: true,
    status: true,
    totalGross: true,
    totalNet: true,
    discountTotal: true,
    metadata: true,
    whatsappLink: true,
    userId: true,
    createdAt: true,
    updatedAt: true,
    placedAt: true,
    confirmedAt: true,
    cancelledAt: true,
    cancellationReason: true,
    note: true,
  } as const;

  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateOrderDto) {
    const totalNet = dto.totalNet ?? dto.totalGross;
    const discountTotal = dto.discountTotal ?? 0;

    const metadata = this.buildMetadata(dto);

    const order = await this.prisma.order.create({
      data: {
        status: OrderStatus.PENDING,
        channel: 'web',
        user: dto.userId ? { connect: { id: dto.userId } } : undefined,
        totalGross: new Prisma.Decimal(dto.totalGross),
        totalNet: new Prisma.Decimal(totalNet),
        discountTotal: new Prisma.Decimal(discountTotal),
        note: dto.notes,
        whatsappLink: dto.whatsappLink,
        metadata: metadata as Prisma.InputJsonValue,
        placedAt: new Date(),
      },
      select: this.baseSelect,
    });

    return this.mapOrder(order);
  }

  async findAll({ status, skip = 0, take = 25, userId }: FindAllParams = {}) {
    const where: Prisma.OrderWhereInput = {};

    if (status) {
      where.status = status;
    }

    if (userId) {
      where.userId = userId;
    }

    const [items, total] = await this.prisma.$transaction([
      this.prisma.order.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
        select: this.baseSelect,
      }),
      this.prisma.order.count({ where }),
    ]);

    return {
      items: items.map((order) => this.mapOrder(order)),
      total,
      skip,
      take,
    };
  }

  async findOne(id: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      select: this.baseSelect,
    });

    if (!order) {
      throw new NotFoundException(`Pedido ${id} no encontrado.`);
    }

    return this.mapOrder(order);
  }

  async findForUser(userId: string, take = 10) {
    const orders = await this.prisma.order.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take,
      select: this.baseSelect,
    });

    return orders.map((order) => this.mapOrder(order));
  }

  async confirm(id: string) {
    const order = await this.getOrderOrThrow(id);

    if (order.status === OrderStatus.CANCELLED) {
      throw new BadRequestException('No se puede confirmar un pedido cancelado.');
    }

    if (order.status === OrderStatus.CONFIRMED) {
      return this.mapOrder(order);
    }

    const updated = await this.prisma.order.update({
      where: { id },
      data: {
        status: OrderStatus.CONFIRMED,
        confirmedAt: new Date(),
        cancelledAt: null,
        cancellationReason: null,
      },
      select: this.baseSelect,
    });

    return this.mapOrder(updated);
  }

  async cancel(id: string, payload: UpdateOrderStatusDto) {
    const order = await this.getOrderOrThrow(id);

    if (order.status === OrderStatus.CANCELLED) {
      return this.mapOrder(order);
    }

    const updated = await this.prisma.order.update({
      where: { id },
      data: {
        status: OrderStatus.CANCELLED,
        cancelledAt: new Date(),
        cancellationReason: payload.reason ?? null,
      },
      select: this.baseSelect,
    });

    return this.mapOrder(updated);
  }

  private async getOrderOrThrow(id: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      select: this.baseSelect,
    });

    if (!order) {
      throw new NotFoundException(`Pedido ${id} no encontrado.`);
    }

    return order;
  }

  private buildMetadata(dto: CreateOrderDto) {
    const items = dto.items.map((item) => ({
      productId: item.productId ?? null,
      label: item.label,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      lineTotal: item.lineTotal,
      side: item.side ?? null,
      type: item.type ?? null,
      metadata: item.metadata ?? null,
    }));

    return {
      customer: {
        name: dto.customerName,
        email: dto.customerEmail,
        phone: dto.customerPhone,
      },
      delivery: {
        addressLine: dto.delivery.addressLine,
        notes: dto.delivery.notes ?? null,
      },
      paymentMethod: dto.paymentMethod,
      items,
      notes: dto.notes,
      extra: dto.metadata,
    } satisfies Record<string, unknown>;
  }

  private mapOrder(order: OrderPayload) {
    return {
      ...order,
      totalGross: Number(order.totalGross),
      totalNet: Number(order.totalNet),
      discountTotal: Number(order.discountTotal),
    };
  }
}
