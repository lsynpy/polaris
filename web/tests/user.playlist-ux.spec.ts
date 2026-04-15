import { expect, test } from "@playwright/test";

// Helper to mock browser notifications
async function setupNotificationMock(page: any) {
  await page.addInitScript(() => {
    (window as any).Notification = class MockNotification {
      static permission = "granted";
      static requestPermission = async () => "granted";
      constructor(title: string, options: any) {
        (window as any).__lastNotification = { title, options };
      }
    };
  });
}

test.describe("Playlist duplicate handling", () => {
  test.use({ storageState: "playwright/.auth/user.json" });

  test.beforeEach(async ({ page }) => {
    await setupNotificationMock(page);
    await page.goto("/");
  });

  test("Scenario 1: Unsaved playlist duplicate handling", async ({ page }) => {
    // 1. Clear current playlist
    await page.getByText("Playlists").click();
    const clearBtn = page.getByTestId("clear-playlist");
    await expect(clearBtn).toBeEnabled();
    await clearBtn.click();

    // Track API calls
    const apiCalls: string[] = [];
    page.on("request", (req) => {
      if (req.url().includes("/add")) apiCalls.push(req.url());
    });

    // 2. Navigate to albums and queue an album
    await page.getByText("Albums").click();
    const huntAlbum = page.locator("div").filter({ hasText: /^Hunted Khemmis$/ });
    await huntAlbum.getByTestId("queue-all").click();

    // 3. Enqueue same album again
    await huntAlbum.getByTestId("queue-all").click();

    // Asserts
    expect(apiCalls.length).toBe(0); // No API calls

    // Verify notification
    const notification = await page.evaluate(() => (window as any).__lastNotification);
    expect(notification.title).toBe("Duplicate Tracks");

    // Verify local queue count
    await page.getByTestId("sidebar").getByTestId("playback").click();
    await expect(page.getByTestId("song").first()).toBeVisible();
    const songCount = await page.getByTestId("song").count();
    expect(songCount).toBe(5); // Assuming 5 songs per album
  });

  test("Scenario 2: Existing playlist duplicate handling", async ({ page }) => {
    // 1. Create playlist
    await page.getByText("Albums").click();
    const firstAlbum = page.getByTestId("album").first();
    await firstAlbum.getByTestId("play-all").click();

    await page.getByTestId("save-playlist").click();
    await page.getByLabel("Playlist Name").fill("API Test Playlist");
    await page.getByTestId("submit-save-playlist").click();

    // Track API calls
    const apiCalls: string[] = [];
    page.on("request", (req) => {
      if (req.url().includes("/add")) apiCalls.push(req.url());
    });

    // 2. Add album tracks
    await page.getByText("Albums").click();
    await firstAlbum.getByTestId("queue-all").click();

    // 3. Add same album tracks again
    await firstAlbum.getByTestId("queue-all").click();

    // Asserts
    expect(apiCalls.length).toBeGreaterThan(0); // API calls were made
    
    // Verify notification on failure (triggered by duplicate add)
    const notification = await page.evaluate(() => (window as any).__lastNotification);
    expect(notification.title).toBe("Duplicate Tracks");
    
    // Verify playlist count
    await page.getByTestId("sidebar").getByTestId("playback").click();
    await expect(page.getByTestId("song").first()).toBeVisible();
    const songCount = await page.getByTestId("song").count();
    expect(songCount).toBe(5); // Still only 5
  });
});
