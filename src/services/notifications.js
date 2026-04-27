// Notifications service — browser Notification API
// Schedules reminders for upcoming stays and post-stay rating prompts.
// In a production app, you'd use Firebase Cloud Messaging for reliable
// push even when the app is closed. This uses the simpler browser API
// which works when the app tab is open.

let permission = "default";

/**
 * Request notification permission on first sign-in.
 */
export async function requestNotificationPermission() {
  if (!("Notification" in window)) return;
  if (Notification.permission === "granted") {
    permission = "granted";
    return;
  }
  if (Notification.permission !== "denied") {
    const result = await Notification.requestPermission();
    permission = result;
  }
}

/**
 * Schedule notifications for upcoming stays.
 * - 1 day before check-in: "Your stay at X starts tomorrow!"
 * - On check-out day: "How was your stay at X? Rate it now."
 * 
 * Uses setTimeout for simplicity. For production, use FCM + Cloud Functions.
 */
const scheduledIds = new Set();

export function scheduleStayNotifications(stays) {
  if (permission !== "granted") return;

  const now = Date.now();

  stays.forEach((stay) => {
    if (scheduledIds.has(stay.id)) return;

    // Check-in reminder (1 day before)
    if (stay.checkIn) {
      const checkInDate = new Date(stay.checkIn + "T09:00:00");
      const reminderTime = checkInDate.getTime() - 24 * 60 * 60 * 1000; // 1 day before
      const delay = reminderTime - now;

      if (delay > 0 && delay < 7 * 24 * 60 * 60 * 1000) { // Within next 7 days
        setTimeout(() => {
          new Notification("Traverse", {
            body: `Your stay at ${stay.hotel} starts tomorrow!`,
            icon: "/favicon.svg",
          });
        }, delay);
      }
    }

    // Post-stay rating prompt (on check-out day at 6pm)
    if (stay.checkOut) {
      const checkOutDate = new Date(stay.checkOut + "T18:00:00");
      const delay = checkOutDate.getTime() - now;

      if (delay > 0 && delay < 30 * 24 * 60 * 60 * 1000) { // Within next 30 days
        setTimeout(() => {
          new Notification("Traverse", {
            body: `How was your stay at ${stay.hotel}? Open Traverse to rate it.`,
            icon: "/favicon.svg",
          });
        }, delay);
      }
    }

    scheduledIds.add(stay.id);
  });
}
