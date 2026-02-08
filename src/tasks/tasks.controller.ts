import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
  UsePipes,
} from '@nestjs/common';
import { Request } from 'express';
import { ProjectRole, WorkspaceRole } from 'generated/prisma/enums';
import { AuthGuard } from 'src/common/guards/auth/auth.guard';
import { ZodValidationPipe } from 'src/common/pipes/zod-validation/zod-validation.pipe';
import { ProjectRoles } from 'src/projects/decorators/project-roles.decorator';
import { ProjectRoleGuard } from 'src/projects/guards/project-role.guard';
import createTaskSchema, { CreateTaskDto } from './dto/create-task.schema';
import { GetTasksDto, getTasksSchema } from './dto/get-tasks.schema';
import { TasksService } from './tasks.service';
import { WorkspaceRoleGuard } from 'src/workspaces/guards/workspace-role.guard';
import { WorkspaceRoles } from 'src/workspaces/decorators/workspace-roles.decorator';

@UseGuards(AuthGuard)
@Controller('projects/:projectId/tasks')
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Post('/')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(WorkspaceRoleGuard)
  @WorkspaceRoles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN)
  @UsePipes(new ZodValidationPipe(createTaskSchema))
  createTask(
    @Param('projectId') projectId: string,
    @Body() data: CreateTaskDto,
    @Req() req: Request,
  ) {
    return this.tasksService.createTask(projectId, data, req);
  }

  @Get('/')
  @HttpCode(HttpStatus.OK)
  @UseGuards(WorkspaceRoleGuard)
  @WorkspaceRoles(
    WorkspaceRole.OWNER,
    WorkspaceRole.ADMIN,
    WorkspaceRole.MEMBER,
  )
  @UsePipes(new ZodValidationPipe(getTasksSchema))
  getTasks(
    @Param('projectId') projectId: string,
    @Query() query: GetTasksDto,
    @Req() req: Request,
  ) {
    return this.tasksService.getTasks(projectId, query, req);
  }
}
