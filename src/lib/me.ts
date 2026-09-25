import 'server-only';

import { cache } from 'react';

import { get } from './api';
import type { Role } from './format';

export interface Me {
  id: string;
  name: string;
  email: string;
  role: Role;
  lastLoginAt: string | null;
  badges: { tickets: number };
}

/** The signed-in admin, once per request. */
export const me = cache(() => get<Me>('/v1/admin/auth/me'));
