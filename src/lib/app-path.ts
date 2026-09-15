const configuredBasePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

export const appBasePath = configuredBasePath === "/" ? "" : configuredBasePath.replace(/\/$/, "");

export function appPath(path: string) {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${appBasePath}${normalized}`;
}
