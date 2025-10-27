import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateMenuCategoryDto } from '../dto/create-menu-category.dto';
import { UpdateMenuCategoryDto } from '../dto/update-menu-category.dto';
import { CreateMenuItemDto, MenuItemOptionInput } from '../dto/create-menu-item.dto';
import { UpdateMenuItemDto } from '../dto/update-menu-item.dto';

@Injectable()
export class MenuService {
  constructor(private readonly prisma: PrismaService) { }

  async listCategories(includeInactive = false) {
    return this.prisma.menuCategory.findMany({
      where: includeInactive ? undefined : { isActive: true },
      orderBy: { sortOrder: 'asc' },
      include: {
        items: {
          where: includeInactive ? undefined : { isVisible: true },
          orderBy: { sortOrder: 'asc' },
          include: {
            options: {
              orderBy: { sortOrder: 'asc' },
            },
          },
        },
      },
    });
  }

  async getPublicMenu() {
    return this.prisma.menuCategory.findMany({
      where: {
        isActive: true,
        items: {
          some: { isVisible: true },
        },
      },
      orderBy: { sortOrder: 'asc' },
      include: {
        items: {
          where: { isVisible: true },
          orderBy: { sortOrder: 'asc' },
          include: {
            options: { orderBy: { sortOrder: 'asc' } },
          },
        },
      },
    });
  }

  async createCategory(dto: CreateMenuCategoryDto) {
    const slug = await this.ensureUniqueCategorySlug(dto.name, dto.slug);
    return this.prisma.menuCategory.create({
      data: {
        name: dto.name,
        slug,
        description: dto.description,
        heroTitle: dto.heroTitle,
        heroSubtitle: dto.heroSubtitle,
        sortOrder: dto.sortOrder ?? 0,
        isActive: dto.isActive ?? true,
      },
    });
  }

  async updateCategory(id: string, dto: UpdateMenuCategoryDto) {
    const existing = await this.findCategoryOrThrow(id);
    const slug = dto.slug || (dto.name ? await this.ensureUniqueCategorySlug(dto.name, dto.slug, id) : existing.slug);

    return this.prisma.menuCategory.update({
      where: { id },
      data: {
        name: dto.name ?? existing.name,
        slug,
        description: dto.description ?? existing.description,
        heroTitle: dto.heroTitle ?? existing.heroTitle,
        heroSubtitle: dto.heroSubtitle ?? existing.heroSubtitle,
        sortOrder: dto.sortOrder ?? existing.sortOrder,
        isActive: dto.isActive ?? existing.isActive,
      },
    });
  }

  async archiveCategory(id: string) {
    await this.findCategoryOrThrow(id);
    return this.prisma.menuCategory.update({
      where: { id },
      data: { isActive: false },
    });
  }

  async listItems(categoryId?: string) {
    return this.prisma.menuItem.findMany({
      where: {
        categoryId,
      },
      orderBy: { sortOrder: 'asc' },
      include: {
        category: true,
        options: { orderBy: { sortOrder: 'asc' } },
      },
    });
  }

  async createItem(dto: CreateMenuItemDto) {
    await this.findCategoryOrThrow(dto.categoryId);
    const slug = await this.ensureUniqueItemSlug(dto.name, dto.slug);

    const result = await this.prisma.menuItem.create({
      data: {
        category: {
          connect: { id: dto.categoryId },
        },
        product: dto.productId ? { connect: { id: dto.productId } } : undefined,
        slug,
        name: dto.name,
        shortName: dto.shortName,
        description: dto.description,
        imageUrl: dto.imageUrl,
        badgeLabel: dto.badgeLabel,
        highlight: dto.highlight ?? false,
        basePrice: this.toDecimalStrict(dto.basePrice),
        originalPrice: this.toDecimalOptional(dto.originalPrice),
        isLocked: dto.isLocked ?? false,
        requiresSide: dto.requiresSide ?? false,
        isShareable: dto.isShareable ?? true,
        isVisible: dto.isVisible ?? true,
        sortOrder: dto.sortOrder ?? 0,
        metadata: this.toJsonInput(dto.metadata),
        options: dto.options?.length ? { create: dto.options.map((option) => this.mapOption(option)) } : undefined,
      },
      include: {
        options: { orderBy: { sortOrder: 'asc' } },
        category: true,
      },
    });

    return result;
  }

  async updateItem(id: string, dto: UpdateMenuItemDto) {
    const existing = await this.findItemOrThrow(id);

    if (dto.categoryId) {
      await this.findCategoryOrThrow(dto.categoryId);
    }

    const slug = dto.slug || (dto.name ? await this.ensureUniqueItemSlug(dto.name, dto.slug, id) : existing.slug);

    const payload: Prisma.MenuItemUpdateInput = {
      category: dto.categoryId
        ? {
          connect: { id: dto.categoryId },
        }
        : undefined,
      product:
        dto.productId !== undefined
          ? dto.productId
            ? { connect: { id: dto.productId } }
            : { disconnect: true }
          : undefined,
      slug,
      name: dto.name ?? existing.name,
      shortName: dto.shortName ?? existing.shortName,
      description: dto.description ?? existing.description,
      imageUrl: dto.imageUrl ?? existing.imageUrl,
      badgeLabel: dto.badgeLabel ?? existing.badgeLabel,
      highlight: dto.highlight ?? existing.highlight,
      basePrice: dto.basePrice !== undefined ? this.toDecimalStrict(dto.basePrice) : undefined,
      originalPrice: dto.originalPrice !== undefined ? this.toDecimalOptional(dto.originalPrice) : undefined,
      isLocked: dto.isLocked ?? existing.isLocked,
      requiresSide: dto.requiresSide ?? existing.requiresSide,
      isShareable: dto.isShareable ?? existing.isShareable,
      isVisible: dto.isVisible ?? existing.isVisible,
      sortOrder: dto.sortOrder ?? existing.sortOrder,
      metadata: dto.metadata !== undefined ? this.toJsonInput(dto.metadata) : undefined,
    };

    return this.prisma.$transaction(async (tx) => {
      let updated = await tx.menuItem.update({
        where: { id },
        data: payload,
        include: {
          category: true,
          options: { orderBy: { sortOrder: 'asc' } },
        },
      });

      if (dto.options !== undefined) {
        await tx.menuItemOption.deleteMany({ where: { itemId: id } });
        if (dto.options && dto.options.length > 0) {
          await tx.menuItemOption.createMany({
            data: dto.options.map((option) => ({
              itemId: id,
              ...this.mapOption(option),
            })),
          });
        }
        updated = (await tx.menuItem.findUnique({
          where: { id },
          include: {
            category: true,
            options: { orderBy: { sortOrder: 'asc' } },
          },
        }))!;
      }

      return updated;
    });
  }

  async toggleItemVisibility(id: string, isVisible: boolean) {
    await this.findItemOrThrow(id);
    return this.prisma.menuItem.update({
      where: { id },
      data: { isVisible },
    });
  }

  async removeItem(id: string, hardDelete = false) {
    await this.findItemOrThrow(id);
    if (hardDelete) {
      await this.prisma.menuItem.delete({ where: { id } });
      return { id, removed: true };
    }
    return this.prisma.menuItem.update({ where: { id }, data: { isVisible: false } });
  }

  private mapOption(option: MenuItemOptionInput) {
    return {
      label: option.label,
      description: option.description,
      priceModifier: this.toDecimalOptional(option.priceModifier),
      sortOrder: option.sortOrder ?? 0,
      isDefault: option.isDefault ?? false,
    };
  }

  private async findCategoryOrThrow(id: string) {
    const category = await this.prisma.menuCategory.findUnique({ where: { id } });
    if (!category) {
      throw new NotFoundException(`Categoría no encontrada (${id}).`);
    }
    return category;
  }

  private async findItemOrThrow(id: string) {
    const item = await this.prisma.menuItem.findUnique({ where: { id } });
    if (!item) {
      throw new NotFoundException(`Item de menú no encontrado (${id}).`);
    }
    return item;
  }

  private async ensureUniqueCategorySlug(name: string, slug?: string, excludeId?: string) {
    const base = this.slugify(slug || name);
    return this.ensureUniqueSlug('category', base, excludeId);
  }

  private async ensureUniqueItemSlug(name: string, slug?: string, excludeId?: string) {
    const base = this.slugify(slug || name);
    return this.ensureUniqueSlug('item', base, excludeId);
  }

  private async ensureUniqueSlug(model: 'category' | 'item', baseSlug: string, excludeId?: string) {
    let candidate = baseSlug;
    let counter = 1;

    while (true) {
      const existing =
        model === 'category'
          ? await this.prisma.menuCategory.findFirst({
            where: {
              slug: candidate,
              NOT: excludeId ? { id: excludeId } : undefined,
            },
          })
          : await this.prisma.menuItem.findFirst({
            where: {
              slug: candidate,
              NOT: excludeId ? { id: excludeId } : undefined,
            },
          });

      if (!existing) {
        return candidate;
      }

      candidate = `${baseSlug}-${counter++}`;
      if (counter > 99) {
        throw new BadRequestException('No se pudo generar un slug único, intentá con otro nombre.');
      }
    }
  }

  private slugify(value: string) {
    return value
      .toString()
      .normalize('NFD')
      .replace(/[^\w\s-]/g, '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-');
  }

  private toDecimalStrict(value: number) {
    if (value === undefined || value === null || Number.isNaN(value)) {
      throw new BadRequestException('El valor numérico proporcionado no es válido.');
    }
    return new Prisma.Decimal(value);
  }

  private toDecimalOptional(value?: number) {
    if (value === undefined || value === null) {
      return undefined;
    }
    if (Number.isNaN(value)) {
      throw new BadRequestException('El valor numérico proporcionado no es válido.');
    }
    return new Prisma.Decimal(value);
  }

  private toJsonInput(payload?: Record<string, any>) {
    if (payload === undefined) {
      return undefined;
    }
    return payload as Prisma.InputJsonValue;
  }
}
