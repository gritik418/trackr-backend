import { Module } from '@nestjs/common';
import { WorkspacesController } from './workspaces.controller';
import { WorkspacesService } from './workspaces.service';
import { WorkspaceInvitesController } from './invites/workspace-invites.controller';
import { WorkspaceInvitesService } from './invites/workspace-invites.service';
import { HashingModule } from 'src/common/hashing/hashing.module';
import { EmailModule } from 'src/queues/email/email.module';

@Module({
  imports: [HashingModule, EmailModule],
  controllers: [WorkspacesController, WorkspaceInvitesController],
  providers: [WorkspacesService, WorkspaceInvitesService],
})
export class WorkspacesModule {}
