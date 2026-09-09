import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { QueryMediaAssetsDto } from "./dto/query-media-assets.dto";
import { CreateExternalAssetDto } from "./dto/create-external-asset.dto";
import { AssetSource, Role } from "../generated/prisma/client";
import { validateAndInspectExternalUrl } from "../common/utils/url-validator.util";

@Injectable()
export class MediaAssetsService {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
  ) {}

  async findAll(query: QueryMediaAssetsDto, user: { id: string; role: Role }) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const skip = (page - 1) * limit;
    const { search, mediaType, source } = query;

    const where: any = {};

    // Teachers view only their own assets; Admins view all assets
    if (user.role !== Role.ADMIN) {
      where.uploaderId = user.id;
    }

    if (search && search.trim()) {
      where.name = {
        contains: search.trim(),
        mode: "insensitive",
      };
    }

    if (mediaType) {
      where.mediaType = mediaType;
    }

    if (source) {
      where.source = source;
    }

    const [total, items] = await Promise.all([
      this.prisma.mediaAsset.count({ where }),
      this.prisma.mediaAsset.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          _count: {
            select: {
              resources: true,
              videos: true,
            },
          },
        },
      }),
    ]);

    const totalPages = Math.ceil(total / limit) || 1;

    return {
      items: items.map((item) => ({
        ...item,
        usageCount: item._count.resources + item._count.videos,
      })),
      meta: {
        page,
        limit,
        total,
        totalPages,
      },
    };
  }

  async findOne(id: string, user: { id: string; role: Role }) {
    const asset = await this.prisma.mediaAsset.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            resources: true,
            videos: true,
          },
        },
      },
    });

    if (!asset) {
      throw new NotFoundException("Media asset not found");
    }

    if (user.role !== Role.ADMIN && asset.uploaderId !== user.id) {
      throw new ForbiddenException("You do not have permission to access this media asset");
    }

    return {
      ...asset,
      usageCount: asset._count.resources + asset._count.videos,
    };
  }

  async createExternal(dto: CreateExternalAssetDto, user: { id: string; role: Role }) {
    // 1. Validate scheme, guard against SSRF, inspect URL reachability
    const inspected = await validateAndInspectExternalUrl(dto.url);

    // 2. Persist MediaAsset record
    return this.prisma.mediaAsset.create({
      data: {
        uploaderId: user.id,
        name: dto.name.trim(),
        fileUrl: inspected.normalizedUrl,
        fileType: inspected.mimeType,
        fileSize: inspected.fileSize ?? null,
        durationSeconds: dto.durationSeconds ?? null,
        source: AssetSource.EXTERNAL_URL,
        mediaType: dto.mediaType,
      },
    });
  }

  async remove(id: string, user: { id: string; role: Role }) {
    await this.findOne(id, user);

    const resourceCount = await this.prisma.resource.count({ where: { assetId: id } });
    const videoCount = await this.prisma.video.count({ where: { assetId: id } });
    const totalUsage = resourceCount + videoCount;

    if (totalUsage > 0) {
      throw new BadRequestException(
        `Cannot delete asset because it is currently attached to ${totalUsage} lesson(s). Please remove it from those lessons first.`,
      );
    }

    await this.prisma.mediaAsset.delete({
      where: { id },
    });

    return { message: "Media asset deleted successfully from library" };
  }
}
