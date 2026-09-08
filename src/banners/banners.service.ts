import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateBannerDto } from "./dto/create-banner.dto";
import { UpdateBannerDto } from "./dto/update-banner.dto";
import { BannerOrderItemDto } from "./dto/reorder-banners.dto";
import { RedisCacheService } from "../common/cache/redis-cache.service";

const BANNERS_CACHE_KEY = "banners:active";

@Injectable()
export class BannersService {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Optional()
    @Inject(RedisCacheService)
    private readonly cacheService?: RedisCacheService,
  ) {}

  private async invalidateCache() {
    if (this.cacheService) {
      await this.cacheService.del(BANNERS_CACHE_KEY);
    }
  }

  async findActive() {
    if (this.cacheService) {
      const cached = await this.cacheService.get<any[]>(BANNERS_CACHE_KEY);
      if (cached) {
        return cached;
      }
    }

    const banners = await this.prisma.banner.findMany({
      where: { isActive: true },
      orderBy: [{ order: "asc" }, { createdAt: "desc" }],
    });

    if (this.cacheService) {
      await this.cacheService.set(BANNERS_CACHE_KEY, banners, 600); // 10 mins
    }

    return banners;
  }

  async findAll() {
    return this.prisma.banner.findMany({
      orderBy: [{ order: "asc" }, { createdAt: "desc" }],
    });
  }

  async findOne(id: string) {
    const banner = await this.prisma.banner.findUnique({
      where: { id },
    });
    if (!banner) {
      throw new NotFoundException("Banner not found");
    }
    return banner;
  }

  async create(dto: CreateBannerDto) {
    // Calculate max order + 1
    const lastBanner = await this.prisma.banner.findFirst({
      orderBy: { order: "desc" },
    });
    const nextOrder = lastBanner ? lastBanner.order + 1 : 0;

    const banner = await this.prisma.banner.create({
      data: {
        title: dto.title.trim(),
        imageUrl: dto.imageUrl.trim(),
        linkUrl: dto.linkUrl ? dto.linkUrl.trim() : null,
        isActive: dto.isActive !== undefined ? dto.isActive : true,
        order: nextOrder,
      },
    });

    await this.invalidateCache();
    return banner;
  }

  async update(id: string, dto: UpdateBannerDto) {
    await this.findOne(id);

    const updateData: any = {};
    if (dto.title !== undefined) updateData.title = dto.title.trim();
    if (dto.imageUrl !== undefined) updateData.imageUrl = dto.imageUrl.trim();
    if (dto.linkUrl !== undefined) updateData.linkUrl = dto.linkUrl ? dto.linkUrl.trim() : null;
    if (dto.isActive !== undefined) updateData.isActive = dto.isActive;
    if (dto.order !== undefined) updateData.order = dto.order;

    const updated = await this.prisma.banner.update({
      where: { id },
      data: updateData,
    });

    await this.invalidateCache();
    return updated;
  }

  async remove(id: string) {
    await this.findOne(id);

    await this.prisma.banner.delete({
      where: { id },
    });

    await this.invalidateCache();
    return { message: "Banner deleted successfully" };
  }

  async reorder(orders: BannerOrderItemDto[]) {
    // Validate uniqueness of IDs and target orders
    const ids = orders.map((o) => o.id);
    const uniqueIds = new Set(ids);
    if (uniqueIds.size !== ids.length) {
      throw new BadRequestException("Duplicate banner IDs provided in reorder list");
    }

    await this.prisma.$transaction(
      orders.map((item) =>
        this.prisma.banner.update({
          where: { id: item.id },
          data: { order: item.order },
        }),
      ),
    );

    await this.invalidateCache();
    return this.findAll();
  }
}
