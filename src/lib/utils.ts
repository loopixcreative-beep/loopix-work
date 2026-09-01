import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Turns a name into a URL-safe, lowercase, hyphenated segment. Purely
 * cosmetic — the id alongside it in the URL is what's actually looked up. */
export function slugify(text: string) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Builds a project detail URL, appending a readable slug when a name is
 * available. The id is always what's actually used to look the project up —
 * the slug segment is decorative only. */
export function projectPath(id: string, name?: string | null) {
  const slug = name ? slugify(name) : '';
  return slug ? `/app/projects/${id}/${slug}` : `/app/projects/${id}`;
}
