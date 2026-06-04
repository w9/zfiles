import { appBasePath, stripAppBasePath, withAppBasePath } from "./appBase";

export type AppRoute = "explorer" | "settings";

function internalRoutePathname(route: AppRoute): string {
  return route === "settings" ? "/settings" : "/";
}

export function routeFromPathname(pathname: string, base?: string): AppRoute {
  const normalized = stripAppBasePath(pathname, base ?? appBasePath()).replace(/\/+$/, "") || "/";
  if (normalized === "/settings") {
    return "settings";
  }
  return "explorer";
}

export function pathnameForRoute(route: AppRoute, base?: string): string {
  return withAppBasePath(internalRoutePathname(route), base ?? appBasePath());
}
