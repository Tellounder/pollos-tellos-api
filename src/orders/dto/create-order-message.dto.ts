import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateOrderMessageDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(800)
  message!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  context?: string;
}
