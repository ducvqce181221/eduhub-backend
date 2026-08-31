import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateResourceDto } from "./dto/create-resource.dto";
import { UpdateResourceDto } from "./dto/update-resource.dto";

@Injectable()
export class ResourcesService {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
  ) {}

  async create(lessonId: string, dto: CreateResourceDto) {
    const lesson = await this.prisma.lesson.findUnique({
      where: { id: lessonId },
    });

    if (!lesson) {
      throw new NotFoundException("Lesson not found");
    }

    if (!dto.fileSize || dto.fileSize <= 0) {
      throw new BadRequestException("fileSize must be greater than 0");
    }

    return this.prisma.resource.create({
      data: {
        lessonId,
        name: dto.name.trim(),
        fileUrl: dto.fileUrl.trim(),
        fileType: dto.fileType.trim(),
        fileSize: dto.fileSize,
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
