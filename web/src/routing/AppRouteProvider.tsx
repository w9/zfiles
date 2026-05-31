import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import {
  pathnameForRoute,
  routeFromPathname,
  type AppRoute,
} from "./appRoute";

type AppRouteContextValue = {
  route: AppRoute;
  navigate: (route: AppRoute) => void;
};

const AppRouteContext = createContext<AppRouteContextValue | null>(null);

export function AppRouteProvider({ children }: { children: ReactNode }) {
  const [route, setRoute] = useState<AppRoute>(() =>
    routeFromPathname(window.location.pathname),
  );
  const enteredSettingsFromExplorerRef = useRef(false);

  useEffect(() => {
    const onPopState = () => {
      enteredSettingsFromExplorerRef.current = false;
      setRoute(routeFromPathname(window.location.pathname));
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const navigate = useCallback((next: AppRoute) => {
    if (next === "explorer" && enteredSettingsFromExplorerRef.current) {
      enteredSettingsFromExplorerRef.current = false;
      window.history.back();
      return;
    }

    const pathname = pathnameForRoute(next);
    const url = new URL(window.location.href);
    url.pathname = pathname;
    const href = `${url.pathname}${url.search}${url.hash}`;
    const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (current !== href) {
      if (next === "settings" && route === "explorer") {
        enteredSettingsFromExplorerRef.current = true;
      }
      window.history.pushState(null, "", href);
    }
    setRoute(next);
  }, [route]);

  const value = useMemo(
    () => ({
      route,
      navigate,
    }),
    [route, navigate],
  );

  return <AppRouteContext.Provider value={value}>{children}</AppRouteContext.Provider>;
}

export function useAppRoute(): AppRouteContextValue {
  const value = useContext(AppRouteContext);
  if (!value) {
    throw new Error("useAppRoute must be used within AppRouteProvider");
  }
  return value;
}
