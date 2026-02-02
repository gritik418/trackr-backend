import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { OrganizationsService } from './organizations.service';
import { CreateOrganizationDto } from './dto/create-organization.schema';
import { AuthGuard } from 'src/common/guards/auth/auth.guard';
import { Request } from 'express';

@Controller('organizations')
export class OrganizationsController {
  constructor(private readonly orgrganizationService: OrganizationsService) {}

  @Post('/')
  @UseGuards(AuthGuard)
  create(@Body() data: CreateOrganizationDto, @Req() req: Request) {
    return this.orgrganizationService.createOrganization(data, req);
  }
}
