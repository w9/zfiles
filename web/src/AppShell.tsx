import { ExplorerApp } from "@/explorer";
import { useAppRoute } from "@/routing/AppRouteProvider";
import SettingsPage from "@/settings/SettingsPage";

export default function AppShell() {
  const { route } = useAppRoute();

  if (route === "settings") {
    return <SettingsPage />;
  }

  return <ExplorerApp />;
}
