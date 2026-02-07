import { SetMetadata } from '@nestjs/common';
import { OrgRole } from 'generated/prisma/enums';

export const ORG_ROLES_KEY = 'org_roles';

export const OrgRoles = (...roles: OrgRole[]) =>
  SetMetadata(ORG_ROLES_KEY, roles);
