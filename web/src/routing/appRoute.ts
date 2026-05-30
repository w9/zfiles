export type AppRoute = "explorer" | "settings";

export function routeFromPathname(pathname: string): AppRoute {
  const normalized = pathname.replace(/\/+$/, "") || "/";
  if (normalized === "/settings") {
    return "settings";
  }
  return "explorer";
}

export function pathnameForRoute(route: AppRoute): string {
  return route === "settings" ? "/settings" : "/";
}
