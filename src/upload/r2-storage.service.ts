import {
  BadRequestException,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { nanoid } from "nanoid";
import { PresignedUrlDto, UploadFolder } from "./dto/presigned-url.dto";
import { slugify } from "../common/utils/slug.util";

export interface PresignedUrlResponse {
  uploadUrl: string;
  fileUrl: string;
  key: string;
  expiresIn: number;
}

@Injectable()
export class R2StorageService {
  private readonly logger = new Logger(R2StorageService.name);
  private s3Client: S3Client | null = null;

  constructor(
    @Inject(ConfigService)
    private readonly configService: ConfigService,
  ) {}

  private getS3Client(): S3Client {
    if (this.s3Client) {
      return this.s3Client;
    }

    const accountId = this.configService.get<string>("R2_ACCOUNT_ID");
    const accessKeyId = this.configService.get<string>("R2_ACCESS_KEY_ID");
    const secretAccessKey = this.configService.get<string>("R2_SECRET_ACCESS_KEY");

    if (!accountId || !accessKeyId || !secretAccessKey) {
      throw new InternalServerErrorException(
        "Cloudflare R2 storage credentials (R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY) are not configured",
      );
    }

    this.s3Client = new S3Client({
      region: "auto",
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
      requestChecksumCalculation: "WHEN_REQUIRED",
      responseChecksumValidation: "WHEN_REQUIRED",
    });

    return this.s3Client;
  }

  async generatePresignedPutUrl(
    dto: PresignedUrlDto,
  ): Promise<PresignedUrlResponse> {
    const { fileName, fileType, fileSize, folder } = dto;

    const bucketName = this.configService.get<string>("R2_BUCKET_NAME");
    const publicDomain = this.configService.get<string>("R2_PUBLIC_DOMAIN");

    if (!bucketName || !publicDomain) {
      throw new InternalServerErrorException(
        "Cloudflare R2 storage target (R2_BUCKET_NAME, R2_PUBLIC_DOMAIN) is not configured",
      );
    }

    // Validate size and mime-type limits [FR-M03]
    const MAX_VIDEO_SIZE = 200 * 1024 * 1024; // 200MB
    const MAX_RESOURCE_SIZE = 50 * 1024 * 1024; // 50MB

    if (folder === UploadFolder.VIDEOS) {
      if (!fileType.startsWith("video/")) {
        throw new BadRequestException(
          "Invalid file type for video folder. Must be a valid video MIME type.",
        );
      }
      if (fileSize > MAX_VIDEO_SIZE) {
        throw new BadRequestException(
          `Video file size exceeds maximum limit of 200MB (${fileSize} bytes provided).`,
        );
      }
    } else if (folder === UploadFolder.RESOURCES) {
      if (fileSize > MAX_RESOURCE_SIZE) {
        throw new BadRequestException(
          `Resource file size exceeds maximum limit of 50MB (${fileSize} bytes provided).`,
        );
      }
    }

    const dotIndex = fileName.lastIndexOf(".");
    const ext = dotIndex !== -1 ? fileName.substring(dotIndex) : "";
    const baseName =
      dotIndex !== -1 ? fileName.substring(0, dotIndex) : fileName;
    const sanitizedBase = slugify(baseName) || "file";
    const uniqueKey = `${folder}/${Date.now()}-${nanoid(8)}-${sanitizedBase}${ext}`;

    const client = this.getS3Client();
    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: uniqueKey,
      ContentType: fileType,
    });

    const expiresIn = 900; // 15 minutes
    const uploadUrl = await getSignedUrl(client, command, {
      expiresIn,
      unhoistableHeaders: new Set([
        "x-amz-checksum-crc32",
        "x-amz-checksum-crc32c",
        "x-amz-checksum-sha1",
        "x-amz-checksum-sha256",
        "x-amz-sdk-checksum-algorithm",
      ]),
    });
    const normalizedDomain = publicDomain.replace(/\/+$/, "");
    const fileUrl = `${normalizedDomain}/${uniqueKey}`;

    return {
      uploadUrl,
      fileUrl,
      key: uniqueKey,
      expiresIn,
    };
  }

  extractKeyFromUrl(url: string): string | null {
    if (!url) return null;
    const match = url.match(/(videos\/[^?#]+|resources\/[^?#]+)/);
    return match ? match[1] : null;
  }

  async generatePresignedGetUrl(
    keyOrUrl: string,
    expiresIn = 900,
  ): Promise<string> {
    try {
      const bucketName = this.configService.get<string>("R2_BUCKET_NAME");
      if (!bucketName) return keyOrUrl;

      const key = this.extractKeyFromUrl(keyOrUrl) || keyOrUrl;
      if (!key.startsWith("videos/") && !key.startsWith("resources/")) {
        return keyOrUrl;
      }

      const client = this.getS3Client();
      const command = new GetObjectCommand({
        Bucket: bucketName,
        Key: key,
      });

      return await getSignedUrl(client, command, { expiresIn });
    } catch (err: any) {
      this.logger.warn(`Failed to generate presigned GET URL: ${err.message}`);
      return keyOrUrl;
    }
  }
}
