import {
  Body,
  Controller,
  DefaultValuePipe,
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

@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

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
  ) {
    const status = this.parseStatus(statusRaw);
    return this.ordersService.findAll({ status, skip, take, userId });
  }

  @Get('user/:userId')
  findForUser(
    @Param('userId') userId: string,
    @Query('take', new DefaultValuePipe(10), ParseIntPipe) take = 10,
  ) {
    return this.ordersService.findForUser(userId, take);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.ordersService.findOne(id);
  }

  @Patch(':id/confirm')
  confirm(@Param('id') id: string) {
    return this.ordersService.confirm(id);
  }

  @Patch(':id/cancel')
  cancel(@Param('id') id: string, @Body() dto: UpdateOrderStatusDto) {
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
}
