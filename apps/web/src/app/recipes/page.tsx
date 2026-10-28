// P8 Day 4 — /recipes: catalog browse + "cook with what I have".
//
// Thin server wrapper: AppShell (sidebar, mobile nav and the
// medical-disclaimer footer every authed page carries, pinned by
// appshell-wiring.test.ts) around RecipesView, the client toggle between
// the Day-3 catalog browser and the Day-4 by-ingredients matcher.
import AppShell from '@/components/AppShell';
import RecipesView from '@/components/RecipesView';

export default function RecipesPage() {
  return (
    <AppShell>
      <RecipesView />
    </AppShell>
  );
}
