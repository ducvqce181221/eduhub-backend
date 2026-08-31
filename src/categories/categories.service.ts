import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateCategoryDto } from "./dto/create-category.dto";
import { UpdateCategoryDto } from "./dto/update-category.dto";
import { generateCategorySlug } from "../common/utils/slug.util";

@Injectable()
export class CategoriesService {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
  ) {}

  async findAll(onlyActive: boolean = true) {
    return this.prisma.category.findMany({
      where: onlyActive ? { isActive: true } : undefined,
      orderBy: { name: "asc" },
      include: {
        _count: {
          select: { courses: true },
        },
      },
    });
  }

  async findOne(id: string) {
    const category = await this.prisma.category.findUnique({
      where: { id },
      include: {
        _count: {
          select: { courses: true },
        },
      },
    });

    if (!category) {
      throw new NotFoundException("Category not found");
    }

    return category;
  }

  async create(dto: CreateCategoryDto) {
    if (!dto || !dto.name) {
      throw new BadRequestException("Category name is required");
    }

    const trimmedName = dto.name.trim();
    const slug = dto.slug?.trim() || generateCategorySlug(trimmedName);

    if (!slug) {
      throw new BadRequestException("Invalid category name/slug");
    }

    // Check uniqueness of name and slug [BR-CAT-01]
    const existing = await this.prisma.category.findFirst({
      where: {
        OR: [{ name: trimmedName }, { slug }],
      },
    });

    if (existing) {
      throw new ConflictException(
        "Category with this name or slug already exists",
      );
    }

    return this.prisma.category.create({
      data: {
        name: trimmedName,
        slug,
        description: dto.description?.trim(),
        isActive: dto.isActive !== undefined ? dto.isActive : true,
      },
    });
  }

  async update(id: string, dto: UpdateCategoryDto) {
    await this.findOne(id);

    const updateData: {
      name?: string;
      slug?: string;
      description?: string;
      isActive?: boolean;
    } = {};

    if (dto.name !== undefined) {
      updateData.name = dto.name.trim();
      if (!dto.slug) {
        updateData.slug = generateCategorySlug(updateData.name);
      }
    }

    if (dto.slug !== undefined) {
      updateData.slug = dto.slug.trim();
    }

    if (dto.description !== undefined) {
      updateData.description = dto.description.trim();
    }

    if (dto.isActive !== undefined) {
      updateData.isActive = dto.isActive;
    }

    if (updateData.name || updateData.slug) {
      const existing = await this.prisma.category.findFirst({
        where: {
          AND: [
            { id: { not: id } },
            {
              OR: [
                ...(updateData.name ? [{ name: updateData.name }] : []),
                ...(updateData.slug ? [{ slug: updateData.slug }] : []),
              ],
            },
          ],
        },
      });

      if (existing) {
        throw new ConflictException(
          "Category with this name or slug already exists",
        );
      }
    }

    return this.prisma.category.update({
      where: { id },
      data: updateData,
    });
  }

  async remove(id: string) {
    await this.findOne(id);

    // Safeguard: Category can only be deleted if 0 courses reference it [BR-CAT-02]
    const coursesCount = await this.prisma.course.count({
      where: { categoryId: id },
    });

    if (coursesCount > 0) {
      throw new ConflictException("Category has active courses attached");
    }

    await this.prisma.category.delete({
      where: { id },
    });

    return { message: "Category deleted successfully" };
  }
}
