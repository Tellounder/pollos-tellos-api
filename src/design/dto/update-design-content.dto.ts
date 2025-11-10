import { IsObject } from 'class-validator';

export class UpdateDesignContentDto {
  @IsObject()
  data!: Record<string, unknown>;
}
