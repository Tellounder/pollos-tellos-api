import {
  BadRequestException,
  Body,
  Controller,
  DefaultValuePipe,
  ForbiddenException,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { OrderStatus } from '@prisma/client';
import { CreateOrderDto } from '../dto/create-order.dto';
import { UpdateOrderStatusDto } from '../dto/update-order-status.dto';
import { CreateOrderMessageDto } from '../dto/create-order-message.dto';
import { OrdersService } from '../services/orders.service';
import { Public } from '../../auth/public.decorator';
import { AuthUser } from '../../auth/auth-user.decorator';
import type { RequestUser } from '../../auth/auth-user.interface';
import { AuthzService } from '../../auth/authz.service';
import { UsersService } from '../../users/services/users.service';

@Controller('orders')
export class OrdersController {
  constructor(
    private readonly ordersService: OrdersService,
    private readonly usersService: UsersService,
    private readonly authzService: AuthzService,
  ) {}

  @Public()
  @Post()
  create(@Body() dto: CreateOrderDto) {
    return this.ordersService.create(dto);
  }

  @Get()
  findAll(
    @Query('status') statusRaw?: string,
    @Query('skip', new DefaultValuePipe(0), ParseIntPipe) skip = 0,
    @Query('take', new DefaultValuePipe(25), ParseIntPipe) take = 25,
    @Query('userId') userId?: string,
    @AuthUser() authUser?: RequestUser | null,
  ) {
    this.authzService.ensureAdmin(authUser ?? null);
    const status = this.parseStatus(statusRaw);
    return this.ordersService.findAll({ status, skip, take, userId });
  }

  @Get('user/:userId')
  findForUser(
    @Param('userId') userId: string,
    @Query('take', new DefaultValuePipe(10), ParseIntPipe) take = 10,
    @AuthUser() authUser?: RequestUser | null,
  ) {
    return this.ensureUserAccess(userId, authUser, () => this.ordersService.findForUser(userId, take));
  }

  @Get('user/:userId/active')
  findActiveForUser(
    @Param('userId') userId: string,
    @Query('takeMessages', new DefaultValuePipe(50), ParseIntPipe) takeMessages = 50,
    @AuthUser() authUser?: RequestUser | null,
  ) {
    return this.ensureUserAccess(userId, authUser, () =>
      this.ordersService.findActiveForUser(userId, takeMessages),
    );
  }

  @Get(':id')
  findOne(@Param('id') id: string, @AuthUser() authUser?: RequestUser | null) {
    this.authzService.ensureAdmin(authUser ?? null);
    return this.ordersService.findOne(id);
  }

  @Patch(':id/confirm')
  confirm(@Param('id') id: string, @AuthUser() authUser?: RequestUser | null) {
    this.authzService.ensureAdmin(authUser ?? null);
    return this.ordersService.confirm(id);
  }

  @Patch(':id/prepare')
  prepare(@Param('id') id: string, @AuthUser() authUser?: RequestUser | null) {
    this.authzService.ensureAdmin(authUser ?? null);
    return this.ordersService.prepare(id);
  }

  @Patch(':id/fulfill')
  fulfill(@Param('id') id: string, @AuthUser() authUser?: RequestUser | null) {
    this.authzService.ensureAdmin(authUser ?? null);
    return this.ordersService.fulfill(id);
  }

  @Patch(':id/cancel')
  cancel(
    @Param('id') id: string,
    @Body() dto: UpdateOrderStatusDto,
    @AuthUser() authUser?: RequestUser | null,
  ) {
    this.authzService.ensureAdmin(authUser ?? null);
    return this.ordersService.cancel(id, dto);
  }

  @Get(':id/messages')
  listMessages(
    @Param('id') id: string,
    @Query('take', new DefaultValuePipe(50), ParseIntPipe) take = 50,
    @AuthUser() authUser?: RequestUser | null,
  ) {
    return this.ensureOrderAccess(id, authUser, () => this.ordersService.listMessages(id, take));
  }

  @Post(':id/messages')
  createMessage(
    @Param('id') id: string,
    @Body() dto: CreateOrderMessageDto,
    @AuthUser() authUser?: RequestUser | null,
  ) {
    return this.ensureOrderAccess(id, authUser, async (access) => {
      const text = dto.message.trim();
      if (!text) {
        throw new BadRequestException('El mensaje no puede estar vacío.');
      }
      const metadata = dto.context ? { context: dto.context } : {};
      const authorType = access.role === 'ADMIN' ? 'ADMIN' : 'USER';
      return this.ordersService.addMessage(id, authorType, text, access.userId ?? null, metadata);
    });
  }

  private parseStatus(statusRaw?: string) {
    if (!statusRaw) {
      return undefined;
    }

    const upper = statusRaw.toUpperCase();
    const match = Object.values(OrderStatus).find((status) => status === upper);
    return match;
  }

  private async ensureUserAccess<T>(
    userId: string,
    authUser: RequestUser | null | undefined,
    callback: () => Promise<T> | T,
  ): Promise<T> {
    const userContext = authUser ?? null;
    if (this.authzService.isAdmin(userContext)) {
      return callback();
    }

    this.authzService.ensureAuthenticated(userContext);
    if (!userContext?.email) {
      throw new ForbiddenException('No se pudo validar tu identidad.');
    }

    await this.usersService.ensureBelongsToEmail(userId, userContext.email);

    return callback();
  }

  private async ensureOrderAccess<T>(
    orderId: string,
    authUser: RequestUser | null | undefined,
    callback: (access: { role: 'ADMIN' | 'USER'; userId: string | null; email: string | null }) => Promise<T> | T,
  ): Promise<T> {
    const context = authUser ?? null;
    if (this.authzService.isAdmin(context)) {
      return callback({ role: 'ADMIN', userId: null, email: context?.email ?? null });
    }

    this.authzService.ensureAuthenticated(context);
    if (!context?.email) {
      throw new ForbiddenException('No se pudo validar tu identidad.');
    }

    const order = await this.ordersService.getOrderAccessContext(orderId);
    if (order.userId) {
      await this.usersService.ensureBelongsToEmail(order.userId, context.email);
      return callback({ role: 'USER', userId: order.userId, email: context.email });
    }

    if (!order.customerEmail || order.customerEmail.toLowerCase() !== context.email.toLowerCase()) {
      throw new ForbiddenException('No podés acceder a este pedido.');
    }

    return callback({ role: 'USER', userId: null, email: context.email });
  }
}
