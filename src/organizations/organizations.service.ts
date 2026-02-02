import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateOrganizationDto } from './dto/create-organization.schema';
import { Request } from 'express';

@Injectable()
export class OrganizationsService {
  constructor(private readonly prismaService: PrismaService) {}

  async createOrganization(data: CreateOrganizationDto, req: Request) {
    if (!req.user?.id) throw new UnauthorizedException('Unauthenticated');
    const { name, slug, description, logoUrl, websiteUrl } = data;

    const existingSlug = await this.prismaService.organization.findFirst({
      where: {
        slug,
      },
    });

    if (existingSlug) throw new BadRequestException('Slug is already in use.');

    const existingName = await this.prismaService.organization.findFirst({
      where: {
        name,
        ownerId: req.user.id,
      },
    });
    if (existingName)
      throw new BadRequestException(
        'You have used the same name for another organization.',
      );

    const org = await this.prismaService.organization.create({
      data: {
        name,
        slug,
        description: description || '',
        logoUrl: logoUrl || '',
        websiteUrl: websiteUrl || '',
        ownerId: req.user.id,
        members: {
          create: {
            userId: req.user.id,
            role: 'OWNER',
          },
        },
      },
      include: { members: true },
    });

    return {
      success: true,
      message: 'Organization created successfully.',
      organization: org,
    };
  }

  async getOrganizations(req: Request) {
    if (!req.user?.id) throw new UnauthorizedException('Unauthenticated');

    const organizations = await this.prismaService.organization.findMany({
      where: { members: { some: { userId: req.user.id } } },
    });

    return {
      success: true,
      message: 'Organizations retrieved successfully.',
      organizations,
    };
  }
}
