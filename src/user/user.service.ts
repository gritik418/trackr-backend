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
import { UpdateUserDto } from './dto/update-user.schema';
import { ChangePasswordDto } from './dto/change-password.schema';
import { HashingService } from 'src/common/hashing/hashing.service';

@Injectable()
export class UserService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly cloudinaryService: CloudinaryService,
    private readonly hashingService: HashingService,
  ) {}

  async getUserProfile(req: Request) {
    if (!req.user?.id) throw new UnauthorizedException('Unauthenticated');

    const user = await this.prismaService.user.findUnique({
      where: {
        id: req.user.id,
        isVerified: true,
      },
      include: {
        workspaces: {
          include: { members: { where: { user: { id: req.user.id } } } },
        },
        organizations: {
          include: { members: { where: { user: { id: req.user.id } } } },
        },
      },
    });

    if (!user) throw new NotFoundException('User not found.');
    const workspaces = user.workspaces.map((ws) => {
      return {
        ...ws,
        role: ws.members[0].role,
      };
    });

    const organizations = user.organizations.map((org) => {
      return {
        ...org,
        role: org.members[0].role,
      };
    });

    const sanitizedUser = { ...sanitizeUser(user), workspaces, organizations };

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
      where: { id: req.user.id, isVerified: true },
      select: { avatarPublicId: true },
    });
    if (!user) throw new NotFoundException('User not found.');

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

  async updateUser(data: UpdateUserDto, req: Request) {
    if (!req.user?.id) throw new UnauthorizedException('Unauthenticated');

    const user = await this.prismaService.user.findFirst({
      where: { id: req.user.id, isVerified: true },
      select: { id: true },
    });
    if (!user) throw new NotFoundException('User not found.');

    const updates: UpdateUserDto = {};
    if (data.name !== undefined) updates.name = data.name;
    if (data.username !== undefined) updates.username = data.username;

    if (!Object.keys(updates).length) {
      throw new BadRequestException('No data provided to update.');
    }

    if (data.username !== undefined) {
      const existingUsername = await this.prismaService.user.findFirst({
        where: {
          username: data.username,
          NOT: { id: req.user.id },
        },
      });

      if (existingUsername) {
        console.log(existingUsername);
        if (
          existingUsername?.isVerified ||
          (existingUsername?.verificationTokenExpiry &&
            existingUsername?.verificationTokenExpiry.getTime() >=
              new Date().getTime())
        ) {
          throw new BadRequestException('Username already taken.');
        }

        await this.prismaService.user.delete({
          where: { id: existingUsername.id },
        });
      }
    }

    const updatedUser = await this.prismaService.user.update({
      where: { id: user.id },
      data: updates,
    });

    const sanitizedUser = sanitizeUser(updatedUser);

    return {
      success: true,
      message: 'User updated successfully.',
      user: sanitizedUser,
    };
  }

  async changePassword(data: ChangePasswordDto, req: Request) {
    if (!req.user?.id) throw new UnauthorizedException('Unauthenticated');

    const user = await this.prismaService.user.findFirst({
      where: { id: req.user.id, isVerified: true },
      select: { id: true, password: true },
    });
    if (!user) throw new NotFoundException('User not found.');

    const { oldPassword, password } = data;

    const verifyOldPassword = await this.hashingService.compareHash(
      oldPassword,
      user.password,
    );

    if (!verifyOldPassword)
      throw new BadRequestException('Invalid credentials.');

    if (await this.hashingService.compareHash(password, user.password)) {
      throw new BadRequestException(
        'New password must be different from old password.',
      );
    }

    const hashedPassword = await this.hashingService.hashValue(password);

    await this.prismaService.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
      },
    });

    return {
      success: true,
      message: 'Password changed successfully.',
    };
  }
}
