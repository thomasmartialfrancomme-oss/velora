import type { LucideIcon } from 'lucide-react';
import {
  BellRing,
  BrainCircuit,
  Building2,
  CarFront,
  CreditCard,
  FolderLock,
  LifeBuoy,
  LayoutDashboard,
  Plane,
  Settings2,
  ShieldCheck,
  Sunrise,
  Users,
  Wallet,
  UtensilsCrossed,
} from 'lucide-react';

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  hint?: string;
  admin?: boolean;
};

export type NavGroup = { title: string; items: NavItem[] };

/**
 * The whole navigation, in one place: the sidebar draws from it and the
 * command palette searches it, so the two can never drift apart.
 */
export const NAV_GROUPS: NavGroup[] = [
  {
    title: 'Overview',
    items: [
      { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, hint: 'Briefing, open items, spend' },
      { href: '/briefing', label: 'Daily briefing', icon: Sunrise, hint: 'The morning read' },
      { href: '/ai', label: 'VELORA AI', icon: BrainCircuit, hint: 'Ask, plan, coordinate' },
    ],
  },
  {
    title: 'Estate',
    items: [
      { href: '/properties', label: 'Properties', icon: Building2, hint: 'Residences, condition, budgets' },
      { href: '/people', label: 'People', icon: Users, hint: 'Staff, roles, next tasks' },
      { href: '/vehicles', label: 'Vehicles', icon: CarFront, hint: 'Fleet, servicing, readiness' },
    ],
  },
  {
    title: 'Movement & requests',
    items: [
      { href: '/travel', label: 'Travel', icon: Plane, hint: 'Journeys and arrival plans' },
      { href: '/lifestyle', label: 'Lifestyle', icon: UtensilsCrossed, hint: 'Reservations and access' },
      { href: '/documents', label: 'Documents', icon: FolderLock, hint: 'Contracts, insurance, renewals' },
    ],
  },
  {
    title: 'Records',
    items: [
      { href: '/finance', label: 'Finance', icon: Wallet, hint: 'Expenditure by residence' },
      { href: '/membership', label: 'Membership', icon: CreditCard, hint: 'Tier, billing, invoices' },
      { href: '/settings', label: 'Settings', icon: Settings2, hint: 'Profile, security, data' },
      { href: '/support', label: 'Support', icon: LifeBuoy, hint: 'Speak to the private office' },
    ],
  },
  {
    title: 'Private office',
    items: [{ href: '/admin', label: 'Administration', icon: ShieldCheck, hint: 'Accounts and access queue', admin: true }],
  },
];

export const NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap((group) => group.items);

export const NOTIFICATION_ICON: Record<string, LucideIcon> = {
  insight: Sunrise,
  task: BellRing,
  travel: Plane,
  property: Building2,
  billing: CreditCard,
  security: ShieldCheck,
  ai: BrainCircuit,
  system: BellRing,
};

/** True when the current path is the item itself (not merely a prefix). */
export function isActive(pathname: string, item: NavItem): boolean {
  if (item.href === '/dashboard') return pathname === '/dashboard' || pathname === '/';
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export function titleForPath(pathname: string): { group: string; page: string } {
  const item = [...NAV_ITEMS].sort((a, b) => b.href.length - a.href.length).find((entry) => pathname.startsWith(entry.href));
  const group = NAV_GROUPS.find((candidate) => candidate.items.some((entry) => entry.href === item?.href))?.title ?? 'VELORA';
  return { group, page: item?.label ?? 'Record' };
}
