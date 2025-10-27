import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { MenuService } from '../services/menu.service';
import { CreateMenuCategoryDto } from '../dto/create-menu-category.dto';
import { UpdateMenuCategoryDto } from '../dto/update-menu-category.dto';
import { CreateMenuItemDto } from '../dto/create-menu-item.dto';
import { UpdateMenuItemDto } from '../dto/update-menu-item.dto';
import { Public } from '../../auth/decorators/public.decorator';

@Controller('menu')
export class MenuController {
  constructor(private readonly menuService: MenuService) {}

  // 🔓 Endpoint público: visible sin autenticación (front)
  @Public()
  @Get('public')
  getPublicMenu() {
    return this.menuService.getPublicMenu();
  }

  // 🔒 Endpoints solo admin
  @Get('categories')
  listCategories(@Query('includeInactive') includeInactive?: string) {
    const flag = includeInactive === 'true' || includeInactive === '1';
    return this.menuService.listCategories(flag);
  }

  @Post('categories')
  createCategory(@Body() dto: CreateMenuCategoryDto) {
    return this.menuService.createCategory(dto);
  }

  @Patch('categories/:id')
  updateCategory(@Param('id') id: string, @Body() dto: UpdateMenuCategoryDto) {
    return this.menuService.updateCategory(id, dto);
  }

  @Delete('categories/:id')
  archiveCategory(@Param('id') id: string) {
    return this.menuService.archiveCategory(id);
  }

  @Get('items')
  listItems(@Query('categoryId') categoryId?: string) {
    return this.menuService.listItems(categoryId);
  }

  @Post('items')
  createItem(@Body() dto: CreateMenuItemDto) {
    return this.menuService.createItem(dto);
  }

  @Patch('items/:id')
  updateItem(@Param('id') id: string, @Body() dto: UpdateMenuItemDto) {
    return this.menuService.updateItem(id, dto);
  }

  @Patch('items/:id/visibility')
  updateItemVisibility(
    @Param('id') id: string,
    @Query('visible') visible = 'true',
  ) {
    const flag = visible !== 'false' && visible !== '0';
    return this.menuService.toggleItemVisibility(id, flag);
  }

  @Delete('items/:id')
  removeItem(@Param('id') id: string, @Query('hard') hard?: string) {
    const hardDelete = hard === 'true' || hard === '1';
    return this.menuService.removeItem(id, hardDelete);
  }
}
