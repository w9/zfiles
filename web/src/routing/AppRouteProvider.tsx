import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
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

  useEffect(() => {
    const onPopState = () => {
      setRoute(routeFromPathname(window.location.pathname));
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const navigate = useCallback((next: AppRoute) => {
    const pathname = pathnameForRoute(next);
    if (window.location.pathname !== pathname) {
      window.history.pushState(null, "", pathname);
    }
    setRoute(next);
  }, []);

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
