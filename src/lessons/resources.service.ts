import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateResourceDto } from "./dto/create-resource.dto";
import { UpdateResourceDto } from "./dto/update-resource.dto";
import { AttachResourceFromLibraryDto } from "./dto/attach-from-library.dto";
import { Role } from "../generated/prisma/client";

@Injectable()
export class ResourcesService {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
  ) {}

  async create(lessonId: string, dto: CreateResourceDto) {
    const lesson = await this.prisma.lesson.findUnique({
      where: { id: lessonId },
      include: {
        chapter: {
          include: {
            course: true,
          },
        },
      },
    });

    if (!lesson) {
      throw new NotFoundException("Lesson not found");
    }

    if (dto.fileSize !== undefined && dto.fileSize !== null && dto.fileSize <= 0) {
      throw new BadRequestException("fileSize must be greater than 0");
    }

    const teacherId = lesson.chapter.course.teacherId;
    let assetId = dto.assetId;

    // Automatically register upload into teacher's MediaAsset library if not already linked
    if (!assetId) {
      const asset = await this.prisma.mediaAsset.create({
        data: {
          uploaderId: teacherId,
          name: dto.name.trim(),
          fileUrl: dto.fileUrl.trim(),
          fileType: dto.fileType.trim(),
          fileSize: dto.fileSize ?? null,
          contentHash: dto.contentHash?.toLowerCase().trim() || null,
          source: "R2_UPLOAD",
          mediaType: "DOCUMENT",
        },
      });
      assetId = asset.id;
    }

    return this.prisma.resource.create({
      data: {
        lessonId,
        assetId,
        name: dto.name.trim(),
        fileUrl: dto.fileUrl.trim(),
        fileType: dto.fileType.trim(),
        fileSize: dto.fileSize ?? null,
        isExternal: false,
      },
    });
  }

  async attachFromLibrary(
    lessonId: string,
    dto: AttachResourceFromLibraryDto,
    user: { id: string; role: Role },
  ) {
    const lesson = await this.prisma.lesson.findUnique({
      where: { id: lessonId },
    });

    if (!lesson) {
      throw new NotFoundException("Lesson not found");
    }

    const asset = await this.prisma.mediaAsset.findUnique({
      where: { id: dto.assetId },
    });

    if (!asset) {
      throw new NotFoundException("Media asset not found in library");
    }

    // Ensure teacher owns this asset or user is Admin
    if (user.role !== Role.ADMIN && asset.uploaderId !== user.id) {
      throw new ForbiddenException("You can only attach resources from your own library");
    }

    return this.prisma.resource.create({
      data: {
        lessonId,
        assetId: asset.id,
        name: dto.customName?.trim() || asset.name,
        fileUrl: asset.fileUrl,
        fileType: asset.fileType,
        fileSize: asset.fileSize,
        isExternal: asset.source === "EXTERNAL_URL",
      },
    });
  }

  async findOne(id: string) {
    const resource = await this.prisma.resource.findUnique({
      where: { id },
    });

    if (!resource) {
      throw new NotFoundException("Resource not found");
    }

    return resource;
  }

  async update(id: string, dto: UpdateResourceDto) {
    await this.findOne(id);

    const updateData: any = {};
    if (dto.name !== undefined) {
      updateData.name = dto.name.trim();
    }
    if (dto.fileUrl !== undefined) {
      updateData.fileUrl = dto.fileUrl.trim();
    }
    if (dto.fileType !== undefined) {
      updateData.fileType = dto.fileType.trim();
    }
    if (dto.fileSize !== undefined) {
      if (dto.fileSize <= 0) {
        throw new BadRequestException("fileSize must be greater than 0");
      }
      updateData.fileSize = dto.fileSize;
    }

    return this.prisma.resource.update({
      where: { id },
      data: updateData,
    });
  }

  async remove(id: string) {
    await this.findOne(id);

    await this.prisma.resource.delete({
      where: { id },
    });

    return { message: "Resource deleted successfully" };
  }
}
