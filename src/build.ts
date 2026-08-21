function optionalBuildValue(value: string | undefined) {
  return value && value !== "unknown" ? value : null;
}

export const frontendBuild = {
  version: import.meta.env.VITE_NET_VERSION || "0.2.0-dev.0",
  commit: import.meta.env.VITE_NET_COMMIT_SHA || "development",
  builtAt: optionalBuildValue(import.meta.env.VITE_NET_BUILD_TIME),
  image: optionalBuildValue(import.meta.env.VITE_NET_IMAGE_REF),
};
