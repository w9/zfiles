import {
  createContext,
  useContext,
  type ReactNode,
} from "react";
import { TriangleAlertIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useTranslation } from "@/i18n";

type CloudAuthContextValue = {
  expired: boolean;
  handleAuthError: (error: unknown) => boolean;
  reconnect: () => void;
};

const defaultValue: CloudAuthContextValue = {
  expired: false,
  handleAuthError: () => false,
  reconnect: () => {},
};

const CloudAuthContext = createContext<CloudAuthContextValue>(defaultValue);

type CloudAuthProviderProps = {
  expired: boolean;
  handleAuthError: (error: unknown) => boolean;
  onReconnect: () => void;
  children: ReactNode;
};

export function CloudAuthProvider({
  expired,
  handleAuthError,
  onReconnect,
  children,
}: CloudAuthProviderProps) {
  return (
    <CloudAuthContext.Provider
      value={{
        expired,
        handleAuthError,
        reconnect: onReconnect,
      }}
    >
      {children}
    </CloudAuthContext.Provider>
  );
}

export function useCloudAuth(): CloudAuthContextValue {
  return useContext(CloudAuthContext);
}

export function CloudAuthExpiredBanner() {
  const { expired, reconnect } = useCloudAuth();
  const { t } = useTranslation();

  if (!expired) {
    return null;
  }

  return (
    <Alert variant="destructive" className="shrink-0">
      <TriangleAlertIcon />
      <AlertTitle>{t("connect.authExpired.bannerTitle")}</AlertTitle>
      <AlertDescription className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <span>{t("connect.authExpired.bannerDescription")}</span>
        <Button type="button" size="sm" variant="outline" onClick={reconnect}>
          {t("connect.authExpired.reconnect")}
        </Button>
      </AlertDescription>
    </Alert>
  );
}

