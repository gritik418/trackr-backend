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
import { ProjectRole } from 'generated/prisma/enums';
import { AuthGuard } from 'src/common/guards/auth/auth.guard';
import { ZodValidationPipe } from 'src/common/pipes/zod-validation/zod-validation.pipe';
import { ProjectRoles } from 'src/projects/decorators/project-roles.decorator';
import { ProjectRoleGuard } from 'src/projects/guards/project-role.guard';
import { CommentsService } from './comments.service';
import {
  CreateCommentDto,
  createCommentSchema,
} from './dto/create-comment.schema';
import {
  UpdateCommentDto,
  updateCommentSchema,
} from './dto/update-comment.schema';

@UseGuards(AuthGuard)
@Controller('projects/:projectId/tasks/:taskId/comments')
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  @Post('/')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(ProjectRoleGuard)
  @ProjectRoles(ProjectRole.OWNER, ProjectRole.ADMIN, ProjectRole.MEMBER)
  @UsePipes(new ZodValidationPipe(createCommentSchema))
  createComment(
    @Param('projectId') projectId: string,
    @Param('taskId') taskId: string,
    @Body() data: CreateCommentDto,
    @Req() req: Request,
  ) {
    return this.commentsService.createComment(projectId, taskId, data, req);
  }

  @Get('/')
  @HttpCode(HttpStatus.OK)
  @UseGuards(ProjectRoleGuard)
  @ProjectRoles(ProjectRole.OWNER, ProjectRole.ADMIN, ProjectRole.MEMBER)
  getComments(
    @Param('projectId') projectId: string,
    @Param('taskId') taskId: string,
    @Req() req: Request,
  ) {
    return this.commentsService.getComments(projectId, taskId, req);
  }

  @Patch('/:commentId')
  @HttpCode(HttpStatus.OK)
  @UseGuards(ProjectRoleGuard)
  @ProjectRoles(ProjectRole.OWNER, ProjectRole.ADMIN, ProjectRole.MEMBER)
  @UsePipes(new ZodValidationPipe(updateCommentSchema))
  updateComment(
    @Param('projectId') projectId: string,
    @Param('taskId') taskId: string,
    @Param('commentId') commentId: string,
    @Body() data: UpdateCommentDto,
    @Req() req: Request,
  ) {
    return this.commentsService.updateComment(
      projectId,
      taskId,
      commentId,
      data,
      req,
    );
  }

  @Delete('/:commentId')
  @HttpCode(HttpStatus.OK)
  @UseGuards(ProjectRoleGuard)
  @ProjectRoles(ProjectRole.OWNER, ProjectRole.ADMIN, ProjectRole.MEMBER)
  deleteComment(
    @Param('projectId') projectId: string,
    @Param('taskId') taskId: string,
    @Param('commentId') commentId: string,
    @Req() req: Request,
  ) {
    return this.commentsService.deleteComment(
      projectId,
      taskId,
      commentId,
      req,
    );
  }
}
