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
import { AuthGuard } from 'src/common/guards/auth/auth.guard';
import { ZodValidationPipe } from 'src/common/pipes/zod-validation/zod-validation.pipe';
import createTaskSchema, { CreateTaskDto } from './dto/create-task.schema';
import { TasksService } from './tasks.service';
import { Request } from 'express';

@UseGuards(AuthGuard)
@Controller('workspaces/:workspacesId/tasks')
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Post('/')
  @UsePipes(new ZodValidationPipe(createTaskSchema))
  @HttpCode(HttpStatus.CREATED)
  createTask(
    @Param('workspacesId') workspacesId: string,
    @Body() data: CreateTaskDto,
    @Req() req: Request,
  ) {
    return this.tasksService.createTask(workspacesId, data, req);
  }
}
