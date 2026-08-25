import { randomUUID } from "crypto";
import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Attachment } from "@prisma/client";
import { BlobSASPermissions, BlobServiceClient } from "@azure/storage-blob";
import { PrismaService } from "../../prisma/prisma.service";
import type { AuthenticatedRequestUser } from "../../common/types/authenticated-request-user";
import { CreateUploadUrlDto } from "./dto/create-upload-url.dto";
import { ListFilesQueryDto } from "./dto/list-files-query.dto";

const UPLOAD_SAS_TTL_MS = 15 * 60 * 1000;
const DOWNLOAD_SAS_TTL_MS = 5 * 60 * 1000;
const DEFAULT_CONTAINER = "gs-workhub-files";

@Injectable()
export class FilesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  async createUploadUrl(dto: CreateUploadUrlDto, user: AuthenticatedRequestUser) {
    this.assertExactlyOneParent(dto.projectId, dto.taskId);

    const nextVersion = await this.getNextVersion(dto.fileName, dto.projectId, dto.taskId);
    const blobPath = `${dto.projectId ?? dto.taskId}/${randomUUID()}-${dto.fileName}`;

    const attachment = await this.prisma.attachment.create({
      data: {
        fileName: dto.fileName,
        mimeType: dto.mimeType,
        sizeBytes: dto.sizeBytes,
        blobPath,
        version: nextVersion,
        uploadedById: user.id,
        projectId: dto.projectId,
        taskId: dto.taskId,
      },
    });

    const uploadUrl = await this.getBlockBlobClient(blobPath).generateSasUrl({
      permissions: BlobSASPermissions.parse("racw"),
      expiresOn: new Date(Date.now() + UPLOAD_SAS_TTL_MS),
    });

    return { attachmentId: attachment.id, uploadUrl, blobPath };
  }

  async getDownloadUrl(id: string) {
    const attachment = await this.getOrThrow(id);

    const downloadUrl = await this.getBlockBlobClient(attachment.blobPath).generateSasUrl({
      permissions: BlobSASPermissions.parse("r"),
      expiresOn: new Date(Date.now() + DOWNLOAD_SAS_TTL_MS),
    });

    return {
      downloadUrl,
      fileName: attachment.fileName,
      mimeType: attachment.mimeType,
    };
  }

  async findAll(query: ListFilesQueryDto): Promise<Attachment[]> {
    if (!query.projectId && !query.taskId) {
      throw new BadRequestException("Provide a projectId or taskId to list files.");
    }

    return this.prisma.attachment.findMany({
      where: {
        ...(query.projectId ? { projectId: query.projectId } : {}),
        ...(query.taskId ? { taskId: query.taskId } : {}),
      },
      orderBy: [{ fileName: "asc" }, { version: "desc" }],
    });
  }

  async findVersions(id: string): Promise<Attachment[]> {
    const attachment = await this.getOrThrow(id);

    return this.prisma.attachment.findMany({
      where: {
        fileName: attachment.fileName,
        projectId: attachment.projectId,
        taskId: attachment.taskId,
      },
      orderBy: { version: "desc" },
    });
  }

  async remove(id: string): Promise<void> {
    const attachment = await this.getOrThrow(id);

    await this.getBlockBlobClient(attachment.blobPath).deleteIfExists();
    await this.prisma.attachment.delete({ where: { id } });
  }

  /**
   * Next version number for a given fileName + parent (project or task):
   * one greater than the highest existing version, or 1 if this is the
   * first upload of that file for that parent.
   */
  private async getNextVersion(
    fileName: string,
    projectId?: string,
    taskId?: string,
  ): Promise<number> {
    const latest = await this.prisma.attachment.findFirst({
      where: {
        fileName,
        ...(projectId ? { projectId } : {}),
        ...(taskId ? { taskId } : {}),
      },
      orderBy: { version: "desc" },
      select: { version: true },
    });

    return (latest?.version ?? 0) + 1;
  }

  private async getOrThrow(id: string): Promise<Attachment> {
    const attachment = await this.prisma.attachment.findUnique({ where: { id } });
    if (!attachment) {
      throw new NotFoundException(`Attachment ${id} not found.`);
    }
    return attachment;
  }

  private assertExactlyOneParent(projectId?: string, taskId?: string): void {
    if ((projectId && taskId) || (!projectId && !taskId)) {
      throw new BadRequestException("Provide exactly one of projectId or taskId.");
    }
  }

  /**
   * The BlobServiceClient is intentionally built lazily, inside each method
   * that needs it, rather than in the constructor or onModuleInit. This dev
   * environment has no real Azure credentials configured, and constructing
   * the client eagerly would crash Nest's bootstrap when the connection
   * string is empty.
   */
  private getBlockBlobClient(blobPath: string) {
    const connectionString = this.configService.get<string>("AZURE_STORAGE_CONNECTION_STRING");
    if (!connectionString) {
      throw new ServiceUnavailableException(
        "Azure Blob Storage is not configured — set AZURE_STORAGE_CONNECTION_STRING",
      );
    }

    const containerName =
      this.configService.get<string>("AZURE_STORAGE_CONTAINER") ?? DEFAULT_CONTAINER;

    const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
    return blobServiceClient.getContainerClient(containerName).getBlockBlobClient(blobPath);
  }
}
