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
import { AddProjectMemberDto } from './dto/add-member.schema';

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

  async getProjectMembers(projectId: string, req: Request) {
    const userId = req.user?.id;
    if (!userId) throw new UnauthorizedException('Unauthenticated');

    const project = await this.prismaService.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    const workspaceMember = await this.prismaService.workspaceMember.findUnique(
      {
        where: {
          userId_workspaceId: {
            userId,
            workspaceId: project.workspaceId,
          },
        },
      },
    );

    if (!workspaceMember) {
      throw new UnauthorizedException('You are not a member of this workspace');
    }

    if (project.nature === ProjectNature.PRIVATE) {
      const projectMember = await this.prismaService.projectMember.findUnique({
        where: {
          projectId_userId: {
            projectId,
            userId,
          },
        },
      });

      if (!projectMember) {
        throw new UnauthorizedException('You are not a member of this project');
      }
    }

    const members = await this.prismaService.projectMember.findMany({
      where: {
        projectId,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
          },
        },
      },
    });

    return {
      success: true,
      message: 'Project members fetched successfully',
      members,
    };
  }

  async deleteProject(projectId: string, req: Request) {
    const userId = req.user?.id;
    if (!userId) throw new UnauthorizedException('Unauthenticated');

    const project = await this.prismaService.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    if (project.nature === ProjectNature.PRIVATE) {
      const projectMember = await this.prismaService.projectMember.findUnique({
        where: {
          projectId_userId: {
            projectId,
            userId,
          },
        },
      });
      if (!projectMember) {
        throw new UnauthorizedException('You are not a member of this project');
      }
      if (
        projectMember.role !== ProjectRole.OWNER &&
        projectMember.role !== ProjectRole.ADMIN
      ) {
        throw new ForbiddenException(
          'You are not allowed to delete this project',
        );
      }
    }

    if (project.nature === ProjectNature.PUBLIC) {
      const workspaceMember =
        await this.prismaService.workspaceMember.findUnique({
          where: {
            userId_workspaceId: {
              userId,
              workspaceId: project.workspaceId,
            },
          },
        });
      if (!workspaceMember) {
        throw new UnauthorizedException(
          'You are not a member of this workspace',
        );
      }
      if (
        workspaceMember.role !== ProjectRole.OWNER &&
        workspaceMember.role !== ProjectRole.ADMIN
      ) {
        throw new ForbiddenException(
          'You are not allowed to delete this project',
        );
      }
    }

    await this.prismaService.project.delete({
      where: { id: projectId },
    });

    return {
      success: true,
      message: 'Project deleted successfully',
    };
  }

  async addProjectMember(
    projectId: string,
    data: AddProjectMemberDto,
    req: Request,
  ) {
    const userId = req.user?.id;
    if (!userId) throw new UnauthorizedException('Unauthenticated');

    const project = await this.prismaService.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    const { userId: targetUserId, role } = data;

    const workspaceMember = await this.prismaService.workspaceMember.findUnique(
      {
        where: {
          userId_workspaceId: {
            userId: targetUserId,
            workspaceId: project.workspaceId,
          },
        },
      },
    );

    if (!workspaceMember) {
      throw new BadRequestException('User is not a member of this workspace');
    }

    const existingMember = await this.prismaService.projectMember.findUnique({
      where: {
        projectId_userId: {
          projectId,
          userId: targetUserId,
        },
      },
    });

    if (existingMember) {
      throw new BadRequestException('User is already a member of this project');
    }

    const member = await this.prismaService.projectMember.create({
      data: {
        projectId,
        userId: targetUserId,
        role,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
          },
        },
      },
    });

    return {
      success: true,
      message: 'Member added to project successfully',
      member,
    };
  }
}
