import { Module } from "@nestjs/common";
import { UploadController } from "./upload.controller";
import { CloudinaryService } from "./cloudinary.service";
import { R2StorageService } from "./r2-storage.service";
import { AuthModule } from "../auth/auth.module";

@Module({
  imports: [AuthModule],
  controllers: [UploadController],
  providers: [CloudinaryService, R2StorageService],
  exports: [CloudinaryService, R2StorageService],
})
export class UploadModule {}
