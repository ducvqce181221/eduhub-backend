import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { PrismaModule } from "./prisma/prisma.module";
import { RedisCacheModule } from "./common/cache/redis-cache.module";
import { EventsModule } from "./common/events/events.module";
import { HealthModule } from "./health/health.module";
import { AuthModule } from "./auth/auth.module";
import { UploadModule } from "./upload/upload.module";
import { UsersModule } from "./users/users.module";
import { CategoriesModule } from "./categories/categories.module";
import { CoursesModule } from "./courses/courses.module";
import { ChaptersModule } from "./chapters/chapters.module";
import { LessonsModule } from "./lessons/lessons.module";
import { EnrollmentsModule } from "./enrollments/enrollments.module";
import { ProgressModule } from "./progress/progress.module";
import { QuizzesModule } from "./quizzes/quizzes.module";
import { NotificationsModule } from "./notifications/notifications.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    PrismaModule,
    RedisCacheModule,
    EventsModule,
    HealthModule,
    AuthModule,
    UploadModule,
    UsersModule,
    CategoriesModule,
    CoursesModule,
    ChaptersModule,
    LessonsModule,
    EnrollmentsModule,
    ProgressModule,
    QuizzesModule,
    NotificationsModule,
  ],
})
export class AppModule {}
