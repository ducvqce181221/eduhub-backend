import { customAlphabet } from "nanoid";

const generateNanoidSuffix = customAlphabet(
  "0123456789abcdefghijklmnopqrstuvwxyz",
  6,
);

/**
 * Normalizes text to a URL-friendly slug, converting Vietnamese diacritics.
 */
export function slugify(text: string): string {
  if (!text) return "";

  return text
    .toString()
    .normalize("NFD") // Decompose combined graphemes into base letters and diacritical marks
    .replace(/[\u0300-\u036f]/g, "") // Remove all diacritics
    .replace(/[đĐ]/g, "d") // Replace Vietnamese 'd'/'D' with 'd'
    .toLowerCase()
    .trim()
    .replace(/[\s_]+/g, "-") // Replace spaces and underscores with hyphens first
    .replace(/[^a-z0-9-]/g, "") // Remove non-alphanumeric chars except hyphen
    .replace(/-+/g, "-") // Replace duplicate hyphens
    .replace(/^-+|-+$/g, ""); // Trim leading and trailing hyphens
}

/**
 * Generates a deterministic course slug with 6-char lowercase alphanumeric nanoid suffix [BR-CRS-01].
 * Example: "lap-trinh-nestjs-k8x2d9"
 */
export function generateCourseSlug(title: string): string {
  const baseSlug = slugify(title) || "course";
  const suffix = generateNanoidSuffix();
  return `${baseSlug}-${suffix}`;
}

/**
 * Generates a category slug from name.
 */
export function generateCategorySlug(name: string): string {
  return slugify(name);
}
