/**
 * Formats a ticket number with a leading hash (e.g., 42 -> "#42")
 */
export function formatTicketNumber(ticketNumber: number | string): string {
  if (!ticketNumber && ticketNumber !== 0) return '';
  return `#${ticketNumber}`;
}

/**
 * Truncates text to a maximum length with an ellipsis.
 */
export function truncateText(text: string, maxLength: number): string {
  if (!text || text.length <= maxLength) return text || '';
  return `${text.slice(0, maxLength).trim()}...`;
}

/**
 * Extracts initials from a user's display name (e.g., "John Doe" -> "JD").
 */
export function getInitials(name?: string | null): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) {
    return parts[0].substring(0, 2).toUpperCase();
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * Normalizes and validates email strings.
 */
export function normalizeEmail(email: string): string {
  return email.toLowerCase().trim();
}
