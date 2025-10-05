import {
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

  @Patch(':id/cancel')
  cancel(
    @Param('id') id: string,
    @Body() dto: UpdateOrderStatusDto,
    @AuthUser() authUser?: RequestUser | null,
  ) {
    this.authzService.ensureAdmin(authUser ?? null);
    return this.ordersService.cancel(id, dto);
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
}
