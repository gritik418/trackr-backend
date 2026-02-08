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
import { WorkspaceRole } from 'generated/prisma/enums';
import { AuthGuard } from 'src/common/guards/auth/auth.guard';
import { ZodValidationPipe } from 'src/common/pipes/zod-validation/zod-validation.pipe';
import { WorkspaceRoles } from 'src/workspaces/decorators/workspace-roles.decorator';
import { WorkspaceRoleGuard } from 'src/workspaces/guards/workspace-role.guard';
import createTaskSchema, { CreateTaskDto } from './dto/create-task.schema';
import { TasksService } from './tasks.service';

@UseGuards(AuthGuard, WorkspaceRoleGuard)
@Controller('workspaces/:workspaceId/tasks')
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Post('/')
  @HttpCode(HttpStatus.CREATED)
  @WorkspaceRoles(
    WorkspaceRole.OWNER,
    WorkspaceRole.ADMIN,
    WorkspaceRole.MEMBER,
  )
  @UsePipes(new ZodValidationPipe(createTaskSchema))
  createTask(
    @Param('workspaceId') workspaceId: string,
    @Body() data: CreateTaskDto,
    @Req() req: Request,
  ) {
    return this.tasksService.createTask(workspaceId, data, req);
  }
}
