import { Module } from '@nestjs/common';
import { MenuController } from './controllers/menu.controller';
import { MenuService } from './services/menu.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [MenuController],
  providers: [MenuService],
  exports: [MenuService],
})
export class MenuModule {}
