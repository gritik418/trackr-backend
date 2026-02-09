import {
  Body,
  Controller,
  Delete,
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
import { TaskGuard } from '../guards/task.guard';
import { CommentsService } from './comments.service';
import {
  CreateCommentDto,
  createCommentSchema,
} from './dto/create-comment.schema';
import {
  UpdateCommentDto,
  updateCommentSchema,
} from './dto/update-comment.schema';

@UseGuards(AuthGuard, TaskGuard)
@Controller('tasks/:taskId/comments')
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  @Post('/')
  @HttpCode(HttpStatus.CREATED)
  @UsePipes(new ZodValidationPipe(createCommentSchema))
  createComment(
    @Param('taskId') taskId: string,
    @Body() data: CreateCommentDto,
    @Req() req: Request,
  ) {
    return this.commentsService.createComment(taskId, data, req);
  }

  @Get('/')
  @HttpCode(HttpStatus.OK)
  getComments(@Param('taskId') taskId: string, @Req() req: Request) {
    return this.commentsService.getComments(taskId, req);
  }

  @Patch('/:commentId')
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ZodValidationPipe(updateCommentSchema))
  updateComment(
    @Param('taskId') taskId: string,
    @Param('commentId') commentId: string,
    @Body() data: UpdateCommentDto,
    @Req() req: Request,
  ) {
    return this.commentsService.updateComment(taskId, commentId, data, req);
  }

  @Delete('/:commentId')
  @HttpCode(HttpStatus.OK)
  deleteComment(
    @Param('taskId') taskId: string,
    @Param('commentId') commentId: string,
    @Req() req: Request,
  ) {
    return this.commentsService.deleteComment(taskId, commentId, req);
  }
}
