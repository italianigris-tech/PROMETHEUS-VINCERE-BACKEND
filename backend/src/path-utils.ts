export const basenameAnyPlatform = (filePath: string): string => {
  const normalized = filePath.replace(/\\/g, "/");
  const parts = normalized.split("/").filter(Boolean);
  return parts.at(-1) ?? "";
};

export const extnameAnyPlatform = (filePath: string): string => {
  const fileName = basenameAnyPlatform(filePath);
  const index = fileName.lastIndexOf(".");
  return index >= 0 ? fileName.slice(index) : "";
};
