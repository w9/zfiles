import AppShell from "@/AppShell";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ConnectionProvider } from "@/connections/ConnectionContext";
import { ExplorerSettingsProviders } from "@/ExplorerSettingsProviders";
import { I18nProvider } from "@/i18n";

/**
 * The hosted build opens straight into Browser storage; buckets are connections the user
 * picks from the status-bar pill or the command palette.
 */
export default function CloudApp() {
  return (
    <I18nProvider>
      <ExplorerSettingsProviders bootMode="cloud">
        <TooltipProvider>
          <ConnectionProvider mode="cloud">
            <AppShell />
          </ConnectionProvider>
        </TooltipProvider>
      </ExplorerSettingsProviders>
    </I18nProvider>
  );
}
