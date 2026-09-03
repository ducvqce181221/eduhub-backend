import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { PasswordService } from "../auth/password.service";
import type { QueryUsersDto } from "./dto/query-users.dto";
import type { CreateUserDto } from "./dto/create-user.dto";
import type { UpdateUserRoleDto } from "./dto/update-user-role.dto";
import type { UpdateUserStatusDto } from "./dto/update-user-status.dto";

@Injectable()
export class UsersService {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(PasswordService)
    private readonly passwordService: PasswordService,
  ) {}

  async findAll(query: QueryUsersDto) {
    const page = Math.max(1, query?.page ? Number(query.page) : 1);
    const limit = Math.min(100, Math.max(1, query?.limit ? Number(query.limit) : 10));
    const skip = (page - 1) * limit;

    const where: Record<string, any> = {};

    if (query.role) {
      where.role = query.role;
    }

    if (query.isActive !== undefined) {
      where.isActive =
        typeof query.isActive === "string"
          ? query.isActive === "true"
          : Boolean(query.isActive);
    }

    if (query.search) {
      const search = query.search.trim();
      where.OR = [
        { fullName: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
      ];
    }

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        select: {
          id: true,
          email: true,
          fullName: true,
          role: true,
          isActive: true,
          avatarUrl: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      users,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        isActive: true,
        avatarUrl: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException("User not found");
    }

    return user;
  }

  async createUser(dto: CreateUserDto) {
    if (!dto || !dto.email || !dto.password || !dto.fullName) {
      throw new BadRequestException(
        "Email, password, and fullName are required",
      );
    }

    const email = dto.email.trim().toLowerCase();

    // Check if email already exists [BR-USR-04]
    const existing = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existing) {
      throw new ConflictException("Email already exists");
    }

    const passwordHash = await this.passwordService.hashPassword(dto.password);

    const user = await this.prisma.user.create({
      data: {
        email,
        passwordHash,
        fullName: dto.fullName.trim(),
        role: dto.role || "STUDENT",
        isActive: dto.isActive !== undefined ? dto.isActive : true,
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        isActive: true,
        avatarUrl: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return user;
  }

  async updateRole(id: string, dto: UpdateUserRoleDto) {
    if (!dto || !dto.role) {
      throw new BadRequestException("Role is required");
    }

    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException("User not found");
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        role: dto.role,
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        isActive: true,
        avatarUrl: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return updated;
  }

  async updateStatus(
    id: string,
    currentAdminId: string,
    dto: UpdateUserStatusDto,
  ) {
    if (!dto || dto.isActive === undefined) {
      throw new BadRequestException("isActive status is required");
    }

    // Prevent self-lockout
    if (id === currentAdminId && !dto.isActive) {
      throw new BadRequestException("You cannot deactivate your own account");
    }

    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException("User not found");
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        isActive: dto.isActive,
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        isActive: true,
        avatarUrl: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return updated;
  }
}
