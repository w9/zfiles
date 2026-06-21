import { ExplorerApp } from "@/explorer";
import { useAppRoute } from "@/routing/AppRouteProvider";
import SettingsPage from "@/settings/SettingsPage";
import { useUiMode } from "@/useUiMode";
import { useUiModeMismatchHint } from "@/useUiModeMismatchHint";

export default function AppShell() {
  const { route } = useAppRoute();
  const { resolved, setMode } = useUiMode();
  useUiModeMismatchHint({ resolved, setMode });

  if (route === "settings") {
    return <SettingsPage />;
  }

  return <ExplorerApp />;
}
