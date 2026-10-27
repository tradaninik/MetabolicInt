// P8 Day 3 (d3-H) — /recipes: the catalog browse page.
//
// Thin server wrapper: AppShell (sidebar, mobile nav and the
// medical-disclaimer footer every authed page carries, pinned by
// appshell-wiring.test.ts) around the RecipeCatalog client component, which
// owns the filters, pagination and the save-to-my-recipes flow.
import AppShell from '@/components/AppShell';
import RecipeCatalog from '@/components/RecipeCatalog';

export default function RecipesPage() {
  return (
    <AppShell>
      <RecipeCatalog />
    </AppShell>
  );
}
