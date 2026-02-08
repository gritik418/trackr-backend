import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  UseGuards,
  UsePipes,
} from '@nestjs/common';
import { Request } from 'express';
import { AuthGuard } from 'src/common/guards/auth/auth.guard';
import { ZodValidationPipe } from 'src/common/pipes/zod-validation/zod-validation.pipe';
import {
  CreateProjectDto,
  createProjectSchema,
} from './dto/create-project.schema';
import { ProjectsService } from './projects.service';
import { ProjectRoleGuard } from './guards/project-role.guard';
import { ProjectRoles } from './decorators/project-roles.decorator';
import { ProjectRole } from 'generated/prisma/enums';

@UseGuards(AuthGuard, ProjectRoleGuard)
@ProjectRoles(ProjectRole.OWNER, ProjectRole.ADMIN)
@Controller('workspaces/:workspaceId/projects')
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Post('/')
  @HttpCode(HttpStatus.CREATED)
  @UsePipes(new ZodValidationPipe(createProjectSchema))
  createProject(
    @Param('workspaceId') workspaceId: string,
    @Body() data: CreateProjectDto,
    @Req() req: Request,
  ) {
    return this.projectsService.createProject(workspaceId, data, req);
  }
}
