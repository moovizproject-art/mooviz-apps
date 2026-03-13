/**
 * Time utilities for Israel timezone operations.
 * Used by notification services to respect driver schedule and quiet hours.
 */

/**
 * Get current day name in Israel timezone.
 * Returns lowercase: 'sunday', 'monday', etc.
 */
export function getIsraelDayName(): string {
  return new Date()
    .toLocaleDateString("en-US", { weekday: "long", timeZone: "Asia/Jerusalem" })
    .toLowerCase();
}

/**
 * Get current time in Israel as "HH:mm" string.
 */
export function getIsraelTime(): string {
  return new Date().toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Jerusalem",
  });
}

/**
 * Check if a given time (HH:mm) falls within a quiet hours range.
 * Handles overnight ranges (e.g., 22:00 → 07:00).
 */
export function isWithinQuietHours(
  currentTime: string,
  start: string | null | undefined,
  end: string | null | undefined
): boolean {
  if (!start || !end) return false;

  const toMinutes = (t: string): number => {
    const [h, m] = t.split(":").map(Number);
    return (h || 0) * 60 + (m || 0);
  };

  const now = toMinutes(currentTime);
  const s = toMinutes(start);
  const e = toMinutes(end);

  if (s <= e) {
    // Same-day range: 08:00 → 22:00
    return now >= s && now < e;
  } else {
    // Overnight range: 22:00 → 07:00
    return now >= s || now < e;
  }
}

/**
 * Check if a driver is available based on schedule and quiet hours.
 * Returns false if today is a day off or current time is in quiet hours.
 */
export function isDriverAvailableNow(driverPrefs: {
  schedule?: Record<string, boolean>;
  quietHoursStart?: string | null;
  quietHoursEnd?: string | null;
}): boolean {
  // Check schedule (day of week)
  const today = getIsraelDayName();
  if (driverPrefs.schedule && driverPrefs.schedule[today] === false) {
    return false;
  }

  // Check quiet hours
  const currentTime = getIsraelTime();
  if (isWithinQuietHours(currentTime, driverPrefs.quietHoursStart, driverPrefs.quietHoursEnd)) {
    return false;
  }

  return true;
}
