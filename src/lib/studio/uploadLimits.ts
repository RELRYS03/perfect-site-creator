export const MAX_STL_FILE_MB = 500;
export const MAX_STL_FILE_BYTES = MAX_STL_FILE_MB * 1024 * 1024;

export function isSTLFileWithinLimit(size: number): boolean {
  return Number.isFinite(size) && size >= 0 && size <= MAX_STL_FILE_BYTES;
}