import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { UsersService } from "./users.service";
import { QueryUsersDto } from "./dto/query-users.dto";
import { CreateUserDto } from "./dto/create-user.dto";
import { UpdateUserRoleDto } from "./dto/update-user-role.dto";
import { UpdateUserStatusDto } from "./dto/update-user-status.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../auth/guards/jwt-auth.guard";

@ApiTags("Users & Administration")
@Controller("users")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("ADMIN")
@ApiBearerAuth()
export class UsersController {
  constructor(
    @Inject(UsersService)
    private readonly usersService: UsersService,
  ) {}

  @Get()
  @ApiOperation({ summary: "Get paginated user list with filters (Admin only)" })
  @ApiResponse({
    status: 200,
    description: "Paginated list of users",
  })
  @ApiResponse({
    status: 401,
    description: "Unauthorized",
  })
  @ApiResponse({
    status: 403,
    description: "Forbidden - Admin role required",
  })
  async findAll(@Query() query: QueryUsersDto) {
    const result = await this.usersService.findAll(query);
    return {
      data: result.users,
      meta: result.meta,
    };
  }

  @Get(":id")
  @ApiOperation({ summary: "Get user details by ID (Admin only)" })
  @ApiResponse({
    status: 200,
    description: "User details",
  })
  @ApiResponse({
    status: 404,
    description: "User not found",
  })
  async findById(@Param("id") id: string) {
    return this.usersService.findById(id);
  }

  @Post()
  @ApiOperation({ summary: "Create a new user directly (Admin only)" })
  @ApiBody({ type: CreateUserDto })
  @ApiResponse({
    status: 201,
    description: "User created successfully",
  })
  @ApiResponse({
    status: 400,
    description: "Validation error",
  })
  @ApiResponse({
    status: 409,
    description: "Email already exists",
  })
  async create(@Body() dto: CreateUserDto) {
    return this.usersService.createUser(dto);
  }

  @Patch(":id/role")
  @ApiOperation({ summary: "Update user role (Admin only)" })
  @ApiBody({ type: UpdateUserRoleDto })
  @ApiResponse({
    status: 200,
    description: "User role updated successfully",
  })
  @ApiResponse({
    status: 404,
    description: "User not found",
  })
  async updateRole(
    @Param("id") id: string,
    @Body() dto: UpdateUserRoleDto,
  ) {
    return this.usersService.updateRole(id, dto);
  }

  @Patch(":id/status")
  @ApiOperation({ summary: "Update user active status (Admin only)" })
  @ApiBody({ type: UpdateUserStatusDto })
  @ApiResponse({
    status: 200,
    description: "User status updated successfully",
  })
  @ApiResponse({
    status: 400,
    description: "Cannot deactivate your own account",
  })
  @ApiResponse({
    status: 404,
    description: "User not found",
  })
  async updateStatus(
    @Param("id") id: string,
    @CurrentUser() admin: AuthenticatedUser,
    @Body() dto: UpdateUserStatusDto,
  ) {
    return this.usersService.updateStatus(id, admin.id, dto);
  }
}
