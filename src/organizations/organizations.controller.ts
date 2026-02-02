import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
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
}
