import {
  Body,
  Controller,
  DefaultValuePipe,
  Delete,
  ForbiddenException,
  Get,
  Param,
  ParseBoolPipe,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ShareCouponStatus } from '@prisma/client';
import { CreateUserDto } from '../dto/create-user.dto';
import { UpdateUserDto } from '../dto/update-user.dto';
import { UpdateProfileDto } from '../dto/update-profile.dto';
import { CreateUserDiscountDto } from '../dto/create-user-discount.dto';
import { UsersService } from '../services/users.service';
import { AuthUser } from '../../auth/auth-user.decorator';
import type { RequestUser } from '../../auth/auth-user.interface';
import { AuthzService } from '../../auth/authz.service';

@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly authzService: AuthzService,
  ) {}

  @Post()
  create(@Body() createUserDto: CreateUserDto, @AuthUser() authUser?: RequestUser | null) {
    this.authzService.ensureAuthenticated(authUser ?? null);
    if (!authUser?.email) {
      throw new ForbiddenException('No se pudo validar la sesión.');
    }
    if (authUser.email.toLowerCase() !== createUserDto.email.toLowerCase()) {
      throw new ForbiddenException('No podés crear usuarios con otra cuenta.');
    }
    return this.usersService.create(createUserDto);
  }

  @Get()
  findAll(
    @Query('skip', new DefaultValuePipe(0), ParseIntPipe) skip: number,
    @Query('take', new DefaultValuePipe(25), ParseIntPipe) take: number,
    @Query('search') search?: string,
    @Query('activeOnly', new DefaultValuePipe(false), ParseBoolPipe) activeOnly?: boolean,
    @AuthUser() authUser?: RequestUser | null,
  ) {
    this.authzService.ensureAdmin(authUser ?? null);
    return this.usersService.findAll({ skip, take, search, activeOnly });
  }

  @Get(':id')
  findOne(@Param('id') id: string, @AuthUser() authUser?: RequestUser | null) {
    return this.ensureUserAccess(id, authUser, () => this.usersService.findOne(id));
  }

  @Get(':id/engagement')
  getEngagement(@Param('id') id: string, @AuthUser() authUser?: RequestUser | null) {
    return this.ensureUserAccess(id, authUser, () => this.usersService.getEngagementSnapshot(id));
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateUserDto: UpdateUserDto,
    @AuthUser() authUser?: RequestUser | null,
  ) {
    this.authzService.ensureAdmin(authUser ?? null);
    return this.usersService.update(id, updateUserDto);
  }

  @Patch(':id/profile')
  updateProfile(
    @Param('id') id: string,
    @Body() updateProfileDto: UpdateProfileDto,
    @AuthUser() authUser?: RequestUser | null,
  ) {
    return this.ensureUserAccess(id, authUser, () => this.usersService.updateProfile(id, updateProfileDto));
  }

  @Post(':id/purchases')
  registerPurchase(@Param('id') id: string, @AuthUser() authUser?: RequestUser | null) {
    return this.ensureUserAccess(id, authUser, () => this.usersService.registerPurchase(id));
  }

  @Get('share-coupons')
  listShareCouponsGlobal(
    @Query('status') statusRaw?: string,
    @AuthUser() authUser?: RequestUser | null,
  ) {
    this.authzService.ensureAdmin(authUser ?? null);
    const status = statusRaw ? statusRaw.toUpperCase() : undefined;
    return this.usersService.listShareCouponsGlobal(status as ShareCouponStatus | undefined);
  }

  @Get(':id/share-coupons')
  listShareCoupons(@Param('id') id: string, @AuthUser() authUser?: RequestUser | null) {
    return this.ensureUserAccess(id, authUser, () => this.usersService.listShareCoupons(id));
  }

  @Post(':id/share-coupons/issue')
  issueShareCoupons(@Param('id') id: string, @AuthUser() authUser?: RequestUser | null) {
    return this.ensureUserAccess(id, authUser, () => this.usersService.ensureMonthlyShareCoupons(id));
  }

  @Post(':id/share-coupons/:code/activate')
  activateShareCoupon(
    @Param('id') id: string,
    @Param('code') code: string,
    @AuthUser() authUser?: RequestUser | null,
  ) {
    return this.ensureUserAccess(id, authUser, () => this.usersService.activateShareCoupon(id, code));
  }

  @Post(':id/discounts')
  grantDiscount(
    @Param('id') id: string,
    @Body() payload: CreateUserDiscountDto,
    @AuthUser() authUser?: RequestUser | null,
  ) {
    this.authzService.ensureAdmin(authUser ?? null);
    return this.usersService.grantDiscount(id, payload);
  }

  @Get('discount-codes')
  listDiscountCodes(
    @Query('activeOnly', new DefaultValuePipe(false), ParseBoolPipe) activeOnly: boolean,
    @AuthUser() authUser?: RequestUser | null,
  ) {
    this.authzService.ensureAdmin(authUser ?? null);
    return this.usersService.listDiscountCodes({ activeOnly });
  }

  @Delete(':id')
  deactivate(@Param('id') id: string, @AuthUser() authUser?: RequestUser | null) {
    this.authzService.ensureAdmin(authUser ?? null);
    return this.usersService.deactivate(id);
  }

  private async ensureUserAccess<T>(
    userId: string,
    authUser: RequestUser | null | undefined,
    callback: () => Promise<T> | T,
  ): Promise<T> {
    const context = authUser ?? null;
    if (this.authzService.isAdmin(context)) {
      return callback();
    }

    this.authzService.ensureAuthenticated(context);
    if (!context?.email) {
      throw new ForbiddenException('No se pudo validar tu identidad.');
    }

    await this.usersService.ensureBelongsToEmail(userId, context.email);

    return callback();
  }
}
