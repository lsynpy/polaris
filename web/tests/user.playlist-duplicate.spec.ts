import { expect, test } from "@playwright/test";

test("Cannot save playlist with duplicate tracks", async ({ page }) => {
  // Mock Notification API
  await page.addInitScript(() => {
    const mockNotification = function (this: any, title: string, options: any) {
      (window as any).__lastNotification = { title, options };
    };
    (mockNotification as any).permission = "granted";
    (mockNotification as any).requestPermission = async () => "granted";
    (window as any).Notification = mockNotification as any;
  });

  await page.goto("/");

  await page.getByTestId("sidebar").getByTestId("albums").click();
  await page
    .getByTestId("album")
    .filter({ hasText: "Hunted" })
    .getByTestId("album-art")
    .click({ force: true });

  // Play All (5 songs)
  await page.getByTestId("play-all").click();
  // Queue All (+5 songs = 10 total, with duplicates)
  await page.getByTestId("queue-all").click();

  // Try to save
  await page.getByTestId("save-playlist").click();
  await page.getByLabel("Playlist Name").fill("Duplicate Test Playlist");
  await page.getByTestId("submit-save-playlist").click();

  // Check for notification
  await expect
    .poll(async () => {
      return await page.evaluate(() => (window as any).__lastNotification);
    })
    .toEqual({
      title: "Duplicate Track",
      options: {
        body: "Playlist contains duplicate tracks",
        icon: undefined
      }
    });
});
