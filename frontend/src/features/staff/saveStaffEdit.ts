import type { SalonServiceContract } from '@/services/salonService';
import type { StaffMember } from '@/types/salon';
import type { User } from '@/types/auth';

export async function saveStaffEdit(
  service: Pick<SalonServiceContract, 'updateStaffMember' | 'setStaffPortalAccess'>,
  staff: StaffMember,
  profile: Partial<StaffMember>,
  portal: { enable: boolean; identifier: string; password: string },
  actor: User,
) {
  const enable = profile.isActive !== false && portal.enable;
  const identifier = portal.identifier.trim().toLowerCase();
  const password = portal.password.trim();
  if (enable && !identifier) throw new Error('Login identifier is required when enabling staff portal access.');
  if (enable && password && password.length < 6) throw new Error('Portal password must be at least 6 characters.');

  const updated = await service.updateStaffMember(staff.id, profile, actor);
  // Deactivating employment already revokes access. Ordinary profile edits must
  // not reset credentials or re-enable an account.
  const portalChanged = enable !== updated.hasPortalAccess || (enable && (
    identifier !== updated.linkedUserEmail || !!password
  ));
  if (!portalChanged) return updated;

  try {
    const result = await service.setStaffPortalAccess(
      staff.id, enable, enable ? { identifier, password: password || undefined } : undefined, actor,
    );
    return result.staff;
  } catch (error) {
    throw new Error(`Employee details saved, but portal settings could not be saved: ${error instanceof Error ? error.message : 'Please try again.'}`);
  }
}
