import Link from 'next/link';
import AppShell from '../../components/AppShell';
import { requireAdmin } from '../../lib/admin';

const ADMIN_NAV = [
  { href: '/admin', label: 'Stats' },
  { href: '/admin/users', label: 'Users' },
  { href: '/admin/foods', label: 'Foods' },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return (
    <AppShell>
      <div className="mb-6 flex gap-1 border-b border-neutral-200 dark:border-neutral-800">
        {ADMIN_NAV.map((n) => (
          <Link
            key={n.href}
            href={n.href}
            className="border-b-2 border-transparent px-3 py-2 text-sm text-neutral-600 transition hover:border-neutral-400 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white"
          >
            {n.label}
          </Link>
        ))}
      </div>
      {children}
    </AppShell>
  );
}