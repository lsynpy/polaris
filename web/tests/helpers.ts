import { expect, test, type Page } from "@playwright/test";

// Helper to mock browser notifications
export async function setupNotificationMock(page: Page) {
  await page.addInitScript(() => {
    (window as unknown as { Notification: unknown }).Notification =
      class MockNotification {
        static permission = "granted";
        static requestPermission = async () => "granted";
        constructor(title: string, options: unknown) {
          (
            window as unknown as { __lastNotification: unknown }
          ).__lastNotification = { title, options };
        }
      };
  });
}
