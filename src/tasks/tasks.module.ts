import { Module } from '@nestjs/common';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';
import { CommentsController } from './comments/comments.controller';
import { CommentsService } from './comments/comments.service';
import { TaskGuard } from './guards/task.guard';

@Module({
  controllers: [TasksController, CommentsController],
  providers: [TasksService, CommentsService, TaskGuard],
})
export class TasksModule {}
