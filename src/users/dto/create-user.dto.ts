import { IsEmail, IsEnum, IsISO8601, IsOptional, IsPhoneNumber, IsString, MaxLength, MinLength } from 'class-validator';
import { AuthProvider } from '@prisma/client';

export class CreateUserDto {
  @IsEmail()
  email!: string;

  @IsOptional()
  @IsPhoneNumber(undefined, {
    message: 'Ingrese un número de teléfono válido (incluya el código de país si corresponde).',
  })
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  firstName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  lastName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  displayName?: string;

  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  externalAuthId?: string;

  @IsOptional()
  @IsEnum(AuthProvider)
  authProvider?: AuthProvider;

  @IsOptional()
  @IsISO8601()
  termsAcceptedAt?: string;
}
