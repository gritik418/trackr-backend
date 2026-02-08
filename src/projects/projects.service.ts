import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { ProjectRole } from 'generated/prisma/enums';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateProjectDto } from './dto/create-project.schema';

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

    const { name, description } = data;

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
        members: {
          some: {
            userId,
          },
        },
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

    if (!member) {
      throw new UnauthorizedException('You are not a member of this project');
    }

    return {
      success: true,
      message: 'Project fetched successfully',
      project,
    };
  }
}
