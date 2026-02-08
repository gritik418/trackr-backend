import {
  Body,
  Controller,
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
import { Request } from 'express';
import { AuthGuard } from 'src/common/guards/auth/auth.guard';
import { ZodValidationPipe } from 'src/common/pipes/zod-validation/zod-validation.pipe';
import {
  CreateProjectDto,
  createProjectSchema,
} from './dto/create-project.schema';
import {
  UpdateProjectDto,
  updateProjectSchema,
} from './dto/update-project.schema';
import { ProjectsService } from './projects.service';
import { ProjectRoleGuard } from './guards/project-role.guard';
import { ProjectRoles } from './decorators/project-roles.decorator';
import { ProjectRole, WorkspaceRole } from 'generated/prisma/enums';
import { WorkspaceRoleGuard } from 'src/workspaces/guards/workspace-role.guard';
import { WorkspaceRoles } from 'src/workspaces/decorators/workspace-roles.decorator';

@UseGuards(AuthGuard, WorkspaceRoleGuard)
@Controller('workspaces/:workspaceId/projects')
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Post('/')
  @HttpCode(HttpStatus.CREATED)
  @WorkspaceRoles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN)
  @UsePipes(new ZodValidationPipe(createProjectSchema))
  createProject(
    @Param('workspaceId') workspaceId: string,
    @Body() data: CreateProjectDto,
    @Req() req: Request,
  ) {
    return this.projectsService.createProject(workspaceId, data, req);
  }

  @Get('/')
  @HttpCode(HttpStatus.OK)
  @WorkspaceRoles(
    WorkspaceRole.OWNER,
    WorkspaceRole.ADMIN,
    WorkspaceRole.MEMBER,
  )
  getProjects(@Param('workspaceId') workspaceId: string, @Req() req: Request) {
    return this.projectsService.getProjects(workspaceId, req);
  }

  @Get('/:projectId')
  @HttpCode(HttpStatus.OK)
  @UseGuards(ProjectRoleGuard)
  @ProjectRoles(ProjectRole.OWNER, ProjectRole.ADMIN, ProjectRole.MEMBER)
  getProjectById(
    @Param('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
    @Req() req: Request,
  ) {
    return this.projectsService.getProjectById(projectId, req);
  }

  @Patch('/:projectId')
  @HttpCode(HttpStatus.OK)
  @UseGuards(ProjectRoleGuard)
  @ProjectRoles(ProjectRole.OWNER, ProjectRole.ADMIN)
  @UsePipes(new ZodValidationPipe(updateProjectSchema))
  updateProject(
    @Param('projectId') projectId: string,
    @Body() data: UpdateProjectDto,
    @Req() req: Request,
  ) {
    return this.projectsService.updateProject(projectId, data, req);
  }
}
