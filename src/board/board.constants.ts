import { Role } from './types/board.types';

export const BOARD_ACTIONS = {
  UPDATED: 'updated',
  MEMBER_REMOVED: 'member_removed',
  MEMBER_ROLE_CHANGED: 'member_role_changed',
} as const;

export const ERROR_MESSAGES = {
  BOARD_NOT_FOUND: 'Board not found',
  NO_ACCESS: 'You do not have access to this board',
  MEMBER_NOT_FOUND: 'User is not a member of this board',
  RECIPIENT_NOT_FOUND: 'Recipient not found',
  INVITE_NOT_FOUND: 'Invite not found',
  CANNOT_REMOVE_OWNER: 'Cannot remove the board owner',
  ONLY_ADMINS_CAN_REMOVE: 'Only administrators can remove other members',
  CANNOT_CHANGE_OWNER_ROLE: 'Cannot change the board owner role',
  CANNOT_DEMOTE_ONLY_ADMIN: 'Cannot demote the only ADMIN of the board',
  PENDING_INVITE_EXISTS: 'There is already a pending invite for this user',
  ALREADY_MEMBER: 'This user is already a member of the board',
  NO_PERMISSION_FOR_INVITE: 'You do not have permission to accept this invite',
} as const;

export const SUCCESS_MESSAGES = {
  BOARD_DELETED: 'Board deleted successfully',
  MEMBER_REMOVED: 'Member removed successfully',
  ROLE_CHANGED: 'Role changed successfully',
  INVITE_SENT: 'Invite sent successfully',
  INVITE_ACCEPTED: 'Invite accepted successfully',
  INVITE_DECLINED: 'Invite declined successfully',
  OWNERSHIP_TRANSFERRED_ADMIN: 'Ownership transferred to the oldest ADMIN and member removed',
  OWNERSHIP_TRANSFERRED_MEMBER:
    'Ownership transferred to the oldest member (promoted to ADMIN) and user removed',
  BOARD_DELETED_ONLY_OWNER: 'Board deleted, you were the only eligible member (no ADMIN/MEMBER)',
} as const;

export const BOARD_ROLES: Record<'ADMIN' | 'MEMBER' | 'OBSERVER', Role> = {
  ADMIN: Role.ADMIN,
  MEMBER: Role.MEMBER,
  OBSERVER: Role.OBSERVER,
} as const;
