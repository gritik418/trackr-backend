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
import { AuthGuard } from 'src/common/guards/auth/auth.guard';
import { ZodValidationPipe } from 'src/common/pipes/zod-validation/zod-validation.pipe';
import createTaskSchema, { CreateTaskDto } from './dto/create-task.schema';
import { TasksService } from './tasks.service';
import { Request } from 'express';

@UseGuards(AuthGuard)
@Controller('workspaces/:workspaceId/tasks')
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Post('/')
  @UsePipes(new ZodValidationPipe(createTaskSchema))
  @HttpCode(HttpStatus.CREATED)
  createTask(
    @Param('workspaceId') workspaceId: string,
    @Body() data: CreateTaskDto,
    @Req() req: Request,
  ) {
    return this.tasksService.createTask(workspaceId, data, req);
  }

  @Get('/')
  @HttpCode(HttpStatus.OK)
  getTasks(@Param('workspaceId') workspaceId: string) {
    return this.tasksService.getTasks(workspaceId);
  }

  @Get('/:taskId')
  @HttpCode(HttpStatus.OK)
  getTaskDetails(
    @Param('workspaceId') workspaceId: string,
    @Param('taskId') taskId: string,
    @Req() req: Request,
  ) {
    return this.tasksService.getTaskById(taskId, workspaceId, req);
  }
}
