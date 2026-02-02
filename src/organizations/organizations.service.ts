import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateOrganizationDto } from './dto/create-organization.schema';
import { Request } from 'express';

@Injectable()
export class OrganizationsService {
  constructor(private readonly prismaService: PrismaService) {}

  async createOrganization(data: CreateOrganizationDto, req: Request) {
    const { name, slug, description, logoUrl, websiteUrl } = data;
    return {
      success: true,
      user: req.user,
    };
  }
}
