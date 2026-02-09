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
import { ProjectRole } from 'generated/prisma/enums';
import { AuthGuard } from 'src/common/guards/auth/auth.guard';
import { ZodValidationPipe } from 'src/common/pipes/zod-validation/zod-validation.pipe';
import { ProjectRoles } from 'src/projects/decorators/project-roles.decorator';
import { ProjectRoleGuard } from 'src/projects/guards/project-role.guard';
import { AssignTaskDto, assignTaskSchema } from './dto/assign-task.schema';
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

  @Get('/')
  @HttpCode(HttpStatus.OK)
  @UseGuards(ProjectRoleGuard)
  @ProjectRoles(ProjectRole.OWNER, ProjectRole.ADMIN, ProjectRole.MEMBER)
  @UsePipes(new ZodValidationPipe(getTasksSchema))
  getTasks(
    @Param('projectId') projectId: string,
    @Query() query: GetTasksDto,
    @Req() req: Request,
  ) {
    return this.tasksService.getTasks(projectId, query, req);
  }

  @Get('/me')
  @HttpCode(HttpStatus.OK)
  @UseGuards(ProjectRoleGuard)
  @ProjectRoles(ProjectRole.OWNER, ProjectRole.ADMIN, ProjectRole.MEMBER)
  @UsePipes(new ZodValidationPipe(getTasksSchema))
  getMyTasks(
    @Param('projectId') projectId: string,
    @Query() query: GetTasksDto,
    @Req() req: Request,
  ) {
    return this.tasksService.getMyTasks(projectId, query, req);
  }

  @Get('/:taskId')
  @HttpCode(HttpStatus.OK)
  @UseGuards(ProjectRoleGuard)
  @ProjectRoles(ProjectRole.OWNER, ProjectRole.ADMIN, ProjectRole.MEMBER)
  getTaskById(
    @Param('projectId') projectId: string,
    @Param('taskId') taskId: string,
    @Req() req: Request,
  ) {
    return this.tasksService.getTaskById(projectId, taskId, req);
  }

  @Patch('/:taskId')
  @HttpCode(HttpStatus.OK)
  @UseGuards(ProjectRoleGuard)
  @ProjectRoles(ProjectRole.OWNER, ProjectRole.ADMIN)
  @UsePipes(new ZodValidationPipe(updateTaskSchema))
  updateTask(
    @Param('projectId') projectId: string,
    @Param('taskId') taskId: string,
    @Body() data: UpdateTaskDto,
    @Req() req: Request,
  ) {
    return this.tasksService.updateTask(projectId, taskId, data, req);
  }

  @Post('/:taskId/assign')
  @HttpCode(HttpStatus.OK)
  @UseGuards(ProjectRoleGuard)
  @ProjectRoles(ProjectRole.OWNER, ProjectRole.ADMIN, ProjectRole.MEMBER)
  @UsePipes(new ZodValidationPipe(assignTaskSchema))
  assignTask(
    @Param('projectId') projectId: string,
    @Param('taskId') taskId: string,
    @Body() data: AssignTaskDto,
    @Req() req: Request,
  ) {
    return this.tasksService.assignTask(projectId, taskId, data, req);
  }
}
