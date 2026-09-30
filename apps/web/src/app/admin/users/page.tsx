import { prisma } from '../../../lib/prisma';

export default async function AdminUsers() {
  const users = await prisma.user.findMany({
    select: { id: true, email: true, name: true, role: true, onboardingComplete: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  });

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="mb-1 text-2xl font-semibold tracking-tight">Users</h1>
      <p className="mb-6 text-sm text-neutral-500">{users.length} accounts. Profile/health details are not shown.</p>

      <div className="overflow-x-auto rounded-xl border border-neutral-200 dark:border-neutral-800">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500 dark:bg-neutral-900">
            <tr>
              <th className="px-4 py-2">Name</th>
              <th className="px-4 py-2">Email</th>
              <th className="px-4 py-2">Role</th>
              <th className="px-4 py-2">Onboarded</th>
              <th className="px-4 py-2">Joined</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b border-neutral-100 last:border-0 dark:border-neutral-900">
                <td className="px-4 py-2">{u.name ?? '—'}</td>
                <td className="px-4 py-2 font-mono text-xs">{u.email}</td>
                <td className="px-4 py-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs ${
                    u.role === 'admin' ? 'bg-amber-100 text-amber-800' : 'bg-neutral-100 text-neutral-600 dark:bg-neutral-900 dark:text-neutral-400'
                  }`}>{u.role}</span>
                </td>
                <td className="px-4 py-2">{u.onboardingComplete ? '✓' : '—'}</td>
                <td className="px-4 py-2 text-neutral-500">{u.createdAt.toISOString().slice(0, 10)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}