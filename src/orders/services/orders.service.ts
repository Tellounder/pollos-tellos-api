import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { OrderStatus, OrderMessage as OrderMessageModel, Prisma } from '@prisma/client';
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
  itemSnapshots: {
    select: {
      id: true;
      productKey: true;
      label: true;
      quantity: true;
      unitPrice: true;
      originalUnitPrice: true;
      discountValue: true;
      lineTotal: true;
      side: true;
      type: true;
    };
  };
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
  private static readonly MAX_PAGE_SIZE = 100;
  private static readonly DEFAULT_PAGE_SIZE = 25;
  private static readonly ACTIVE_STATUSES = [
    OrderStatus.PENDING,
    OrderStatus.PREPARING,
    OrderStatus.CONFIRMED,
  ];

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
    itemSnapshots: {
      select: {
        id: true,
        productKey: true,
        label: true,
        quantity: true,
        unitPrice: true,
        originalUnitPrice: true,
        discountValue: true,
        lineTotal: true,
        side: true,
        type: true,
      },
    },
  } as const;

  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateOrderDto) {
    const totalNet = dto.totalNet ?? dto.totalGross;
    const discountTotal = dto.discountTotal ?? 0;

    const metadata = this.buildMetadata(dto);

    const normalizedItems = this.buildNormalizedItems(metadata as OrderPayload['metadata']);

    const orderId = await this.prisma.$transaction(async (tx) => {
      const created = await tx.order.create({
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
        select: { id: true },
      });

      if (normalizedItems.length > 0) {
        const snapshotClient = tx as Record<string, unknown>;
        const createMany = (snapshotClient as any).orderItemSnapshot?.createMany?.bind(
          (snapshotClient as any).orderItemSnapshot,
        );

        await createMany?.({
          data: normalizedItems.map((item) => ({
            id: item.id,
            orderId: created.id,
            productKey: item.productKey,
            label: item.label,
            quantity: item.quantity,
            unitPrice: new Prisma.Decimal(item.unitPrice),
            originalUnitPrice: item.originalUnitPrice
              ? new Prisma.Decimal(item.originalUnitPrice)
              : undefined,
            discountValue: item.discountValue ? new Prisma.Decimal(item.discountValue) : undefined,
            lineTotal: new Prisma.Decimal(item.lineTotal),
            side: item.side,
            type: item.type,
          })),
        });
      }

      return created.id;
    });

    const order = await this.getOrderOrThrow(orderId);
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

    const safeSkip = Math.max(0, skip);
    const safeTake = Math.min(
      OrdersService.MAX_PAGE_SIZE,
      Math.max(1, take ?? OrdersService.DEFAULT_PAGE_SIZE),
    );

    const [items, total] = await this.prisma.$transaction([
      this.prisma.order.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: safeSkip,
        take: safeTake,
        select: this.baseSelect,
      }),
      this.prisma.order.count({ where }),
    ]);

    return {
      items: items.map((order) => this.mapOrder(order)),
      total,
      skip: safeSkip,
      take: safeTake,
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
    const safeTake = Math.min(
      OrdersService.MAX_PAGE_SIZE,
      Math.max(1, take ?? OrdersService.DEFAULT_PAGE_SIZE),
    );

    const orders = await this.prisma.order.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: safeTake,
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

  async prepare(id: string) {
    const order = await this.getOrderOrThrow(id);

    if (order.status === OrderStatus.CANCELLED) {
      throw new BadRequestException('No se puede preparar un pedido cancelado.');
    }

    if (order.status === OrderStatus.CONFIRMED || order.status === OrderStatus.FULFILLED) {
      return this.mapOrder(order);
    }

    if (order.status === OrderStatus.PREPARING) {
      return this.mapOrder(order);
    }

    const updated = await this.prisma.order.update({
      where: { id },
      data: {
        status: OrderStatus.PREPARING,
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

  async findActiveForUser(userId: string, takeMessages = 50) {
    const order = await this.prisma.order.findFirst({
      where: {
        userId,
        status: { in: OrdersService.ACTIVE_STATUSES },
      },
      orderBy: { createdAt: 'desc' },
      select: this.baseSelect,
    });

    if (!order) {
      return null;
    }

    const messages = await this.prisma.orderMessage.findMany({
      where: { orderId: order.id },
      orderBy: { createdAt: 'asc' },
      take: Math.max(1, Math.min(takeMessages, 200)),
    });

    return {
      order: this.mapOrder(order),
      messages: messages.map((message) => this.mapMessage(message)),
    };
  }

  async listMessages(orderId: string, take = 50) {
    await this.getOrderOrThrow(orderId);

    const messages = await this.prisma.orderMessage.findMany({
      where: { orderId },
      orderBy: { createdAt: 'asc' },
      take: Math.max(1, Math.min(take, 200)),
    });

    return messages.map((message) => this.mapMessage(message));
  }

  async addMessage(
    orderId: string,
    authorType: 'ADMIN' | 'USER',
    message: string,
    authorId?: string | null,
    metadata: Record<string, unknown> = {},
  ) {
    await this.getOrderOrThrow(orderId);
    const payload = {
      type: 'TEXT',
      message,
      ...metadata,
    };

    const created = await this.prisma.orderMessage.create({
      data: {
        orderId,
        authorType,
        authorId: authorId ?? null,
        payload: payload as Prisma.JsonObject,
      },
    });

    return this.mapMessage(created);
  }

  async getOrderAccessContext(id: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      select: {
        id: true,
        userId: true,
        metadata: true,
      },
    });

    if (!order) {
      throw new NotFoundException(`Pedido ${id} no encontrado.`);
    }

    let customerEmail: string | null = null;
    if (order.metadata && typeof order.metadata === 'object' && !Array.isArray(order.metadata)) {
      const customer = (order.metadata as Record<string, unknown>).customer;
      if (customer && typeof customer === 'object' && !Array.isArray(customer)) {
        const candidate = (customer as Record<string, unknown>).email;
        if (typeof candidate === 'string') {
          customerEmail = candidate;
        }
      }
    }

    return { id: order.id, userId: order.userId, customerEmail };
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

  private mapMessage(message: OrderMessageModel) {
    return {
      id: message.id,
      orderId: message.orderId,
      authorType: message.authorType,
      authorId: message.authorId,
      payload: message.payload,
      createdAt: message.createdAt,
      readAt: message.readAt,
    };
  }

  private buildMetadata(dto: CreateOrderDto) {
    const items = dto.items.map((item) => ({
      productId: item.productId ?? null,
      label: item.label,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      originalUnitPrice: item.originalUnitPrice ?? null,
      discountValue: item.discountValue ?? null,
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
    const typedOrder = order as OrderPayload & {
      itemSnapshots?: Array<{
        id: string;
        productKey: string | null;
        label: string;
        quantity: number;
        unitPrice: Prisma.Decimal;
        originalUnitPrice: Prisma.Decimal | null;
        discountValue: Prisma.Decimal | null;
        lineTotal: Prisma.Decimal;
        side: string | null;
        type: string | null;
      }>;
    };

    const { itemSnapshots, ...baseOrder } = typedOrder;
    const snapshots = Array.isArray(itemSnapshots) ? itemSnapshots : [];

    const normalizedFromSnapshots = snapshots.map((snapshot) => ({
      id: snapshot.id,
      productKey: snapshot.productKey ?? null,
      label: snapshot.label,
      quantity: snapshot.quantity,
      unitPrice: Number(snapshot.unitPrice),
      originalUnitPrice: snapshot.originalUnitPrice ? Number(snapshot.originalUnitPrice) : null,
      discountValue: snapshot.discountValue ? Number(snapshot.discountValue) : null,
      lineTotal: Number(snapshot.lineTotal),
      side: snapshot.side ?? null,
      type: snapshot.type ?? null,
    }));

    return {
      ...baseOrder,
      totalGross: Number(order.totalGross),
      totalNet: Number(order.totalNet),
      discountTotal: Number(order.discountTotal),
      normalizedItems:
        normalizedFromSnapshots.length > 0
          ? normalizedFromSnapshots
          : this.buildNormalizedItems(order.metadata),
    };
  }

  private buildNormalizedItems(metadata: OrderPayload['metadata']) {
    type MetadataItem = {
      productId?: string | null;
      label?: string | null;
      quantity?: number | null;
      unitPrice?: number | null;
      originalUnitPrice?: number | null;
      discountValue?: number | null;
      lineTotal?: number | null;
      side?: string | null;
      type?: string | null;
    };

    if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
      return [] as Array<{
        id: string;
        productKey: string | null;
        label: string;
        quantity: number;
        unitPrice: number;
        originalUnitPrice: number | null;
        discountValue: number | null;
        lineTotal: number;
        side: string | null;
        type: string | null;
      }>;
    }

    const rawItems = (metadata as Record<string, unknown>).items;
    if (!Array.isArray(rawItems)) {
      return [];
    }

    return rawItems
      .filter((candidate): candidate is MetadataItem => typeof candidate === 'object' && candidate !== null)
      .map((item, index) => ({
        id: typeof randomUUID === 'function' ? randomUUID() : `${item.productId ?? 'item'}-${index}-${Date.now()}`,
        productKey: item.productId ?? null,
        label: item.label ?? 'Producto',
        quantity: typeof item.quantity === 'number' && item.quantity > 0 ? item.quantity : 0,
        unitPrice: typeof item.unitPrice === 'number' ? item.unitPrice : 0,
        originalUnitPrice:
          typeof item.originalUnitPrice === 'number' && item.originalUnitPrice > 0
            ? item.originalUnitPrice
            : null,
        discountValue:
          typeof item.discountValue === 'number' && item.discountValue > 0 ? item.discountValue : null,
        lineTotal: typeof item.lineTotal === 'number' ? item.lineTotal : 0,
        side: item.side ?? null,
        type: item.type ?? null,
      }))
      .filter((entry) => entry.quantity > 0 && Boolean(entry.label));
  }
}
