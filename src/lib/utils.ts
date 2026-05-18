import { formatDistanceToNow, parseISO, isYesterday, format } from "date-fns";

export function getAvatarColor(username: string): { bg: string; text: string } {
  if (!username || username.toLowerCase() === "anonymous" || username === "system") {
    return { 
      bg: "var(--color-background-tertiary)", 
      text: "var(--color-text-tertiary)" 
    };
  }

  // Consistent hashing
  let hash = 0;
  for (let i = 0; i < username.length; i++) {
    hash = username.charCodeAt(i) + ((hash << 5) - hash);
  }

  const h = Math.abs(hash) % 360;
  // Dynamic color palette based on username hash
  const bg = `hsl(${h}, 65%, 85%)`;
  const text = `hsl(${h}, 75%, 20%)`;
  return { bg, text };
}

export function formatRelativeTime(dateString: string): string {
  try {
    const date = typeof dateString === "string" ? parseISO(dateString) : new Date(dateString);
    if (isNaN(date.getTime())) return "just now";

    if (isYesterday(date)) {
      return "yesterday";
    }

    const diffInMs = Date.now() - date.getTime();
    const diffInDays = diffInMs / (1000 * 60 * 60 * 24);

    if (diffInDays > 5) {
      return format(date, "MMM d"); // e.g. "May 18"
    }

    // Returns "2h ago", "5m ago", "3d ago"
    const text = formatDistanceToNow(date, { addSuffix: true });
    return text
      .replace("about ", "")
      .replace("less than a minute ago", "just now")
      .replace(" minutes", "m")
      .replace(" minute", "m")
      .replace(" hours", "h")
      .replace(" hour", "h")
      .replace(" days", "d")
      .replace(" day", "d")
      .replace(" ago", " ago");
  } catch (e) {
    return "some time ago";
  }
}
