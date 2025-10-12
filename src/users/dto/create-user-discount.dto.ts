import { IsDateString, IsNumber, IsOptional, IsPositive, IsString, MaxLength } from 'class-validator';

export class CreateUserDiscountDto {
  @IsNumber()
  @IsPositive()
  value!: number;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  label?: string;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}
