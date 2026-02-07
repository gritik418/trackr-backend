import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
  UsePipes,
} from '@nestjs/common';
import { OrganizationsService } from './organizations.service';
import createOrganizationSchema, {
  CreateOrganizationDto,
} from './dto/create-organization.schema';
import { AuthGuard } from 'src/common/guards/auth/auth.guard';
import { Request } from 'express';
import { ZodValidationPipe } from 'src/common/pipes/zod-validation/zod-validation.pipe';
import updateOrganizationSchema, {
  UpdateOrganizationDto,
} from './dto/update-organization.schema';
import { OrgRoleGuard } from './guards/org-role/org-role.guard';
import { OrgRoles } from './decorators/org-roles.decorator';
import { OrgRole } from 'generated/prisma/enums';

@UseGuards(AuthGuard)
@Controller('organizations')
export class OrganizationsController {
  constructor(private readonly orgrganizationService: OrganizationsService) {}

  @Post('/')
  @HttpCode(HttpStatus.CREATED)
  @UsePipes(new ZodValidationPipe(createOrganizationSchema))
  create(@Body() data: CreateOrganizationDto, @Req() req: Request) {
    return this.orgrganizationService.createOrganization(data, req);
  }

  @Get('/')
  @HttpCode(HttpStatus.OK)
  getOrganizations(@Req() req: Request) {
    return this.orgrganizationService.getUserOrganizations(req);
  }

  @Get('/:orgId')
  @HttpCode(HttpStatus.OK)
  getOrganization(@Param('orgId') orgId: string, @Req() req: Request) {
    return this.orgrganizationService.getOrganizationById(orgId, req);
  }

  @Get('/slug/:orgSlug')
  @HttpCode(HttpStatus.OK)
  getOrganizationBySlug(
    @Param('orgSlug') orgSlug: string,
    @Req() req: Request,
  ) {
    return this.orgrganizationService.getOrganizationBySlug(orgSlug, req);
  }

  @Patch('/:orgId')
  @OrgRoles(OrgRole.OWNER)
  @UseGuards(OrgRoleGuard)
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ZodValidationPipe(updateOrganizationSchema))
  updateOrganization(
    @Body() data: UpdateOrganizationDto,
    @Param('orgId') orgId: string,
    @Req() req: Request,
  ) {
    return this.orgrganizationService.updateOrganization(orgId, data, req);
  }

  @Delete('/:orgId')
  @OrgRoles(OrgRole.OWNER)
  @UseGuards(OrgRoleGuard)
  @HttpCode(HttpStatus.OK)
  deleteOrganization(@Param('orgId') orgId: string, @Req() req: Request) {
    return this.orgrganizationService.deleteOrganization(orgId, req);
  }
}
