export const MAX_TITLE = 200

/** Returns an error message, or null when the title is valid. */
export function validateTitle(title: string): string | null {
  if (title.trim() === '') return 'Title is required.'
  if (title.length > MAX_TITLE) return `Title must be at most ${MAX_TITLE} characters.`
  return null
}
