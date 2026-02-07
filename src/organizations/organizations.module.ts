import { Module } from '@nestjs/common';
import { OrganizationsController } from './organizations.controller';
import { OrganizationsService } from './organizations.service';
import { OrgInvitesController } from './invites/org-invites.controller';
import { OrgInvitesService } from './invites/org-invites.service';

@Module({
  controllers: [OrganizationsController, OrgInvitesController],
  providers: [OrganizationsService, OrgInvitesService],
})
export class OrganizationsModule {}
