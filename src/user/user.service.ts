import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { sanitizeUser } from 'src/common/utils/sanitize-user';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class UserService {
  constructor(private readonly prismaService: PrismaService) {}

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
}
