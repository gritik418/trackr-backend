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
import { ProjectRole, WorkspaceRole } from 'generated/prisma/enums';
import { AuthGuard } from 'src/common/guards/auth/auth.guard';
import { ZodValidationPipe } from 'src/common/pipes/zod-validation/zod-validation.pipe';
import { WorkspaceRoles } from 'src/workspaces/decorators/workspace-roles.decorator';
import { WorkspaceRoleGuard } from 'src/workspaces/guards/workspace-role.guard';
import createTaskSchema, { CreateTaskDto } from './dto/create-task.schema';
import { TasksService } from './tasks.service';
import { ProjectRoleGuard } from 'src/projects/guards/project-role.guard';
import { ProjectRoles } from 'src/projects/decorators/project-roles.decorator';

@UseGuards(AuthGuard)
@Controller('projects/:projectId/tasks')
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Post('/')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(ProjectRoleGuard)
  @ProjectRoles(ProjectRole.OWNER, ProjectRole.ADMIN)
  @UsePipes(new ZodValidationPipe(createTaskSchema))
  createTask(
    @Param('projectId') projectId: string,
    @Body() data: CreateTaskDto,
    @Req() req: Request,
  ) {
    return this.tasksService.createTask(projectId, data, req);
  }
}
