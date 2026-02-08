import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
  UsePipes,
} from '@nestjs/common';
import { Request } from 'express';
import { WorkspaceRole } from 'generated/prisma/enums';
import { AuthGuard } from 'src/common/guards/auth/auth.guard';
import { ZodValidationPipe } from 'src/common/pipes/zod-validation/zod-validation.pipe';
import { WorkspaceRoles } from 'src/workspaces/decorators/workspace-roles.decorator';
import { WorkspaceRoleGuard } from 'src/workspaces/guards/workspace-role.guard';
import createTaskSchema, { CreateTaskDto } from './dto/create-task.schema';
import { GetTasksDto, getTasksSchema } from './dto/get-tasks.schema';
import { UpdateTaskDto, updateTaskSchema } from './dto/update-task.schema';
import { TasksService } from './tasks.service';

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

  @Patch('/:taskId')
  @HttpCode(HttpStatus.OK)
  @UseGuards(WorkspaceRoleGuard)
  @WorkspaceRoles(
    WorkspaceRole.OWNER,
    WorkspaceRole.ADMIN,
    WorkspaceRole.MEMBER,
  )
  @UsePipes(new ZodValidationPipe(updateTaskSchema))
  updateTask(
    @Param('projectId') projectId: string,
    @Param('taskId') taskId: string,
    @Body() data: UpdateTaskDto,
    @Req() req: Request,
  ) {
    return this.tasksService.updateTask(projectId, taskId, data, req);
  }
}
