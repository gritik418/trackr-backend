import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { ProjectNature, ProjectRole } from 'generated/prisma/enums';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateProjectDto } from './dto/create-project.schema';
import { UpdateProjectDto } from './dto/update-project.schema';

@Injectable()
export class ProjectsService {
  constructor(private readonly prismaService: PrismaService) {}

  async createProject(
    workspaceId: string,
    data: CreateProjectDto,
    req: Request,
  ) {
    const userId = req.user?.id;
    if (!userId) throw new UnauthorizedException('Unauthenticated');

    const workspace = await this.prismaService.workspace.findUnique({
      where: {
        id: workspaceId,
      },
    });

    if (!workspace) {
      throw new NotFoundException('Workspace not found in this organization');
    }

    const member = await this.prismaService.workspaceMember.findUnique({
      where: {
        userId_workspaceId: {
          userId,
          workspaceId,
        },
      },
    });

    if (!member) {
      throw new UnauthorizedException('You are not a member of this workspace');
    }

    const { name, description, nature } = data;

    const existingProject = await this.prismaService.project.findUnique({
      where: {
        workspaceId_name: {
          workspaceId,
          name,
        },
      },
    });

    if (existingProject) {
      throw new BadRequestException('Project with this name already exists');
    }

    return this.prismaService.$transaction(async (tx) => {
      const project = await tx.project.create({
        data: {
          name,
          description,
          nature,
          workspaceId,
          ownerId: userId,
        },
      });

      await tx.projectMember.create({
        data: {
          projectId: project.id,
          userId,
          role: ProjectRole.OWNER,
        },
      });

      return {
        success: true,
        message: 'Project created successfully',
        project,
      };
    });
  }

  async getProjects(workspaceId: string, req: Request) {
    const userId = req.user?.id;
    if (!userId) throw new UnauthorizedException('Unauthenticated');

    const workspace = await this.prismaService.workspace.findUnique({
      where: {
        id: workspaceId,
      },
    });

    if (!workspace) {
      throw new NotFoundException('Workspace not found in this organization');
    }

    const member = await this.prismaService.workspaceMember.findUnique({
      where: {
        userId_workspaceId: {
          userId,
          workspaceId,
        },
      },
    });

    if (!member) {
      throw new UnauthorizedException('You are not a member of this workspace');
    }

    const projects = await this.prismaService.project.findMany({
      where: {
        workspaceId,
        OR: [
          {
            members: {
              some: {
                userId,
              },
            },
          },
          {
            nature: ProjectNature.PUBLIC,
          },
        ],
      },
    });

    return {
      success: true,
      message: 'Projects fetched successfully',
      projects,
    };
  }

  async getProjectById(projectId: string, req: Request) {
    const userId = req.user?.id;
    if (!userId) throw new UnauthorizedException('Unauthenticated');

    const project = await this.prismaService.project.findUnique({
      where: {
        id: projectId,
      },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    const member = await this.prismaService.projectMember.findUnique({
      where: {
        projectId_userId: {
          projectId,
          userId,
        },
      },
    });

    if (!member && project.nature !== ProjectNature.PUBLIC) {
      throw new UnauthorizedException('You are not a member of this project');
    }

    return {
      success: true,
      message: 'Project fetched successfully',
      project,
    };
  }

  async updateProject(projectId: string, data: UpdateProjectDto, req: Request) {
    const userId = req.user?.id;
    if (!userId) throw new UnauthorizedException('Unauthenticated');

    const project = await this.prismaService.project.findUnique({
      where: { id: projectId },
      include: {
        members: {
          where: { userId },
          select: { role: true },
        },
      },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    const userRole = project.members[0]?.role;
    if (!userRole || !['OWNER', 'ADMIN'].includes(userRole)) {
      throw new ForbiddenException(
        'Only project owner/admin can update project.',
      );
    }

    const { name, description, nature, status } = data;

    if (name && name !== project.name) {
      const existingProject = await this.prismaService.project.findFirst({
        where: {
          workspaceId: project.workspaceId,
          name,
          NOT: { id: projectId },
        },
      });
      if (existingProject) {
        throw new BadRequestException('Project with this name already exists');
      }
    }

    const updatedProject = await this.prismaService.project.update({
      where: { id: projectId },
      data: {
        name,
        description,
        nature,
        status,
      },
    });

    return {
      success: true,
      message: 'Project updated successfully',
      project: updatedProject,
    };
  }
}
