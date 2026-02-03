import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { sanitizeUser } from 'src/common/utils/sanitize-user';
import { PrismaService } from 'src/prisma/prisma.service';
import { CloudinaryService } from 'src/providers/cloudinary/cloudinary.service';
import { avatarUploadOptions } from './uploads/avatar.upload';

@Injectable()
export class UserService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  async getUserProfile(req: Request) {
    if (!req.user?.id) throw new UnauthorizedException('Unauthenticated');

    const user = await this.prismaService.user.findUnique({
      where: {
        id: req.user.id,
        isVerified: true,
      },
    });

    if (!user) throw new NotFoundException('User not found.');

    const sanitizedUser = sanitizeUser(user);

    return {
      success: true,
      message: 'User retrieved successfully.',
      user: sanitizedUser,
    };
  }

  async updateUserAvatar(file: Express.Multer.File, req: Request) {
    if (!req.user?.id) throw new UnauthorizedException('Unauthenticated');
    if (!file) throw new BadRequestException('Avatar image is required');

    const user = await this.prismaService.user.findUnique({
      where: { id: req.user.id },
      select: { avatarPublicId: true },
    });
    if (!user) throw new UnauthorizedException('Unauthenticated');

    if (user.avatarPublicId) {
      await this.cloudinaryService.deleteImage(user.avatarPublicId);
    }

    const avatar = await this.cloudinaryService.uploadImage(
      file,
      avatarUploadOptions,
    );
    if (!avatar || !avatar.publicId || !avatar.url)
      throw new BadRequestException('File upload failed.');

    await this.prismaService.user.update({
      where: {
        id: req.user.id,
      },
      data: {
        avatarUrl: avatar.url,
        avatarPublicId: avatar.publicId,
      },
    });

    return {
      success: true,
      message: 'Avatar updated successfully.',
      url: avatar.url,
    };
  }
}
