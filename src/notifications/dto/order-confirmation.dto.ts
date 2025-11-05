import { Type } from 'class-transformer';
import {
  IsArray,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class OrderConfirmationMessageDto {
  @IsString()
  @IsNotEmpty()
  whatsapp!: string;

  @IsString()
  @IsNotEmpty()
  whatsappUrl!: string;
}

export class OrderConfirmationTemplateDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  subject!: string;

  @IsString()
  @IsNotEmpty()
  html!: string;

  @IsString()
  @IsNotEmpty()
  text!: string;
}

export class OrderConfirmationCustomerDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsEmail()
  email!: string;

  @IsOptional()
  @IsString()
  phone?: string | null;

  @IsString()
  @IsNotEmpty()
  addressLine!: string;

  @IsString()
  @IsNotEmpty()
  paymentMethod!: string;
}

export class OrderConfirmationItemDto {
  @IsOptional()
  @IsString()
  productId?: string;

  @IsString()
  @IsNotEmpty()
  label!: string;

  @IsOptional()
  @IsString()
  description?: string | null;

  @IsNumber()
  quantity!: number;

  @IsNumber()
  unitPrice!: number;

  @IsNumber()
  totalPrice!: number;

  @IsOptional()
  @IsString()
  side?: string | null;

  @IsEnum(['combo', 'extra'])
  type!: 'combo' | 'extra';

  @IsOptional()
  @IsNumber()
  originalUnitPrice?: number | null;

  @IsOptional()
  @IsNumber()
  discountValue?: number | null;
}

export class OrderConfirmationTotalsDto {
  @IsNumber()
  subtotal!: number;

  @IsString()
  subtotalLabel!: string;

  @IsOptional()
  @IsNumber()
  discountAmount?: number;

  @IsOptional()
  @IsString()
  discountLabel?: string;

  @IsOptional()
  @IsString()
  discountDescriptor?: string | null;

  @IsNumber()
  total!: number;

  @IsString()
  totalLabel!: string;
}

export class OrderConfirmationDiscountDto {
  @IsString()
  @IsNotEmpty()
  code!: string;

  @IsOptional()
  @IsString()
  label?: string | null;

  @IsOptional()
  @IsString()
  description?: string | null;

  @IsNumber()
  amount!: number;

  @IsOptional()
  @IsString()
  origin?: string | null;
}

export class OrderConfirmationMetadataDto {
  @IsOptional()
  acceptedUpsell?: boolean;

  @IsOptional()
  guestCheckout?: boolean;

  @IsOptional()
  @IsString()
  source?: string;

  @IsOptional()
  @IsString()
  submittedAt?: string;
}

export class SendOrderConfirmationDto {
  @IsOptional()
  @IsString()
  orderId?: string;

  @IsOptional()
  @IsNumber()
  orderNumber?: number;

  @IsOptional()
  @IsString()
  orderCode?: string;

  @IsEnum(['guest', 'registered'])
  channel!: 'guest' | 'registered';

  @ValidateNested()
  @Type(() => OrderConfirmationCustomerDto)
  customer!: OrderConfirmationCustomerDto;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderConfirmationItemDto)
  items!: OrderConfirmationItemDto[];

  @ValidateNested()
  @Type(() => OrderConfirmationTotalsDto)
  totals!: OrderConfirmationTotalsDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => OrderConfirmationDiscountDto)
  discount?: OrderConfirmationDiscountDto | null;

  @IsOptional()
  @ValidateNested()
  @Type(() => OrderConfirmationMetadataDto)
  metadata?: OrderConfirmationMetadataDto;

  @ValidateNested()
  @Type(() => OrderConfirmationMessageDto)
  message!: OrderConfirmationMessageDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => OrderConfirmationTemplateDto)
  template?: OrderConfirmationTemplateDto;
}
