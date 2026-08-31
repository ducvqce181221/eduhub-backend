import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { PrismaModule } from "./prisma/prisma.module";
import { HealthModule } from "./health/health.module";
import { AuthModule } from "./auth/auth.module";
import { UploadModule } from "./upload/upload.module";
import { UsersModule } from "./users/users.module";
import { CategoriesModule } from "./categories/categories.module";
import { CoursesModule } from "./courses/courses.module";
import { ChaptersModule } from "./chapters/chapters.module";
import { LessonsModule } from "./lessons/lessons.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    PrismaModule,
    HealthModule,
    AuthModule,
    UploadModule,
    UsersModule,
    CategoriesModule,
    CoursesModule,
    ChaptersModule,
    LessonsModule,
  ],
})
export class AppModule {}
