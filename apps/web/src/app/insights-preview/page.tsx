// Additive preview route — safe to delete at any time; nothing else imports it.
//
// If your app uses `src/app` instead of `app`, move this folder there and fix
// the relative import below (one line). See README.md → "Apply".

import { InsightsPreviewScreen } from "../../components/reports/InsightsPreviewScreen";

export default function InsightsPreviewPage() {
  return <InsightsPreviewScreen />;
}
