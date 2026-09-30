import AppShell from '../../components/AppShell';
import { requireAdmin } from '../../lib/admin';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return <AppShell>{children}</AppShell>;
}