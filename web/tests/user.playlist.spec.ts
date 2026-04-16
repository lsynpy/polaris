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

test.afterEach(async ({ page }) => {
  // Clean up playlist state so other tests aren't affected
  await page.goto("/");
  try {
    await page.getByTestId("clear-playlist").click({ force: true });
  } catch {
    // Might already be cleared or on a different view
  }
});

test("Can clear playlist", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("sidebar").getByTestId("albums").click();
  await page
    .getByTestId("album")
    .filter({ hasText: "Picnic", hasNotText: "Remixes" })
    .getByTestId("album-art")
    .click({ force: true });
  await page.getByTestId("play-all").click();
  await expect(page.getByTestId("playlist-song")).toHaveCount(7);

  await page.getByTestId("clear-playlist").click();
  await expect(page.getByTestId("playlist-song")).toHaveCount(0);
});

test("Can remove playlist songs", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("sidebar").getByTestId("albums").click();
  await page
    .getByTestId("album")
    .filter({ hasText: "Picnic", hasNotText: "Remixes" })
    .getByTestId("album-art")
    .click({ force: true });
  await page.getByTestId("play-all").click();
  await expect(page.getByTestId("playlist-song")).toHaveCount(7);

  await page.getByTestId("playlist-song").getByText("Blueberry").click();
  await page
    .getByTestId("playlist-song")
    .getByText("Sherbet")
    .click({ modifiers: ["Shift"] });
  await page.getByTestId("playlist-song").getByText("Sherbet").press("Delete");
  await expect(page.getByTestId("playlist-song")).toHaveCount(4);
});

test("Can jump to a track", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("sidebar").getByTestId("albums").click();
  await page
    .getByTestId("album")
    .filter({ hasText: "Picnic", hasNotText: "Remixes" })
    .getByTestId("album-art")
    .click({ force: true });
  await page.getByTestId("play-all").click();
  await expect(page.getByTestId("playlist-song")).toHaveCount(7);

  await page
    .getByTestId("playlist-song")
    .getByText("Why")
    .click({ clickCount: 2 });
  await expect(page.getByTestId("player")).toContainText("Why");
});

test("Can open playlist stats", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("sidebar").getByTestId("albums").click();
  await page
    .getByTestId("album")
    .filter({ hasText: "Picnic", hasNotText: "Remixes" })
    .getByTestId("album-art")
    .click({ force: true });
  await page.getByTestId("play-all").click();
  await expect(page.getByTestId("playlist-song")).toHaveCount(7);

  await page.getByTestId("show-playlist-stats").click();
  await expect(page.getByTestId("song-count")).toHaveText("7");
});

test("Can save, retrieve, delete playlist", async ({ page }) => {
  const uniqueId = Math.random().toString(36).slice(2);
  const names = [`My Playlist ${uniqueId}`, `??? ${uniqueId}`];
  for (const name of names) {
    await page.goto("/");
    await page.getByTestId("sidebar").getByTestId("albums").click();
    await page
      .getByTestId("album")
      .filter({ hasText: "Hunted" })
      .getByTestId("album-art")
      .click({ force: true });
    await page.getByTestId("play-all").click();
    await page.getByTestId("save-playlist").click();
    await page.getByLabel("Playlist Name").fill(name);
    await page.getByTestId("submit-save-playlist").click();
    await expect(page.locator("form")).not.toBeVisible();

    await page.getByTestId("sidebar").getByTestId("playlists").click();
    await page.getByTestId("saved-playlist").getByText(name).click();
    await expect(
      page
        .getByTestId("saved-playlist-songs")
        .getByTestId("song")
        .locator("visible=true")
    ).toHaveCount(5);
    await page.getByTestId("delete-playlist").click();
    await expect(page).toHaveURL(/\/playlists$/);
    await expect(
      page.getByTestId("saved-playlist").getByText(name)
    ).toHaveCount(0);
  }
});

test("Silently ignores duplicate tracks when saving", async ({ page }) => {
  const uniqueName = `Duplicate Test Playlist ${Math.random().toString(36).slice(2)}`;
  await page.goto("/");

  await page.getByTestId("sidebar").getByTestId("albums").click();
  await page
    .getByTestId("album")
    .filter({ hasText: "Hunted" })
    .getByTestId("album-art")
    .click({ force: true });

  // Play All (5 unique songs)
  await page.getByTestId("play-all").click();
  // Queue All (+5 songs = 10 total, all duplicates of the first 5)
  await page.getByTestId("queue-all").click();

  // Try to save
  await page.getByTestId("save-playlist").click();
  await page.getByLabel("Playlist Name").fill(uniqueName);
  await page.getByTestId("submit-save-playlist").click();

  // Verify successful save: wait for dialog to close and check playlist contents
  await expect(page.locator("form")).not.toBeVisible();

  await page.getByTestId("sidebar").getByTestId("playlists").click();
  await page.getByTestId("saved-playlist").getByText(uniqueName).click();

  // Verify only 5 unique songs were saved
  await expect(
    page
      .getByTestId("saved-playlist-songs")
      .getByTestId("song")
      .locator("visible=true")
  ).toHaveCount(5);

  // Clean up: delete the playlist so it doesn't interfere with other tests
  await page.getByTestId("delete-playlist").click();
});

test.describe("Playlist duplicate handling", () => {
  test.use({ storageState: "playwright/.auth/user.json" });

  test.beforeEach(async ({ page }) => {
    await setupNotificationMock(page);
    await page.goto("/");
    // Wait for the app to be ready
    await expect(page.getByText("Albums")).toBeVisible();
  });

  test("Scenario 1: Unsaved playlist duplicate handling", async ({ page }) => {
    // 1. Clear current playlist: ensure playlist is not empty first
    await page.getByText("Albums").click();
    await page.getByText("All").click();
    await page.getByTestId("album").first().click();
    await page.getByTestId("play-all").click();
    await page.getByText("Playlists").click();
    const clearBtn = page.getByTestId("clear-playlist");
    await expect(clearBtn).toBeEnabled();
    await clearBtn.click();

    // Track API calls
    const apiCalls: string[] = [];
    page.on("request", (req) => {
      if (req.url().includes("/add")) apiCalls.push(req.url());
    });

    // 2. Navigate to albums and queue an album (second album "Picnic" has 7 songs)
    await page.getByText("Albums").click();
    await page.getByText("All").click();
    await page.getByTestId("album").nth(1).click();
    await page.getByTestId("queue-all").click();

    // 3. Enqueue same album again
    await page.getByTestId("queue-all").click();

    // Asserts
    expect(apiCalls.length).toBe(0); // No API calls

    // Verify notification
    const notification = await page.evaluate(
      () => (window as any).__lastNotification
    );
    expect(notification.title).toBe("Duplicate Tracks");

    // Verify local queue count (7 unique songs from second album)
    await expect(page.getByTestId("playlist-song").first()).toBeVisible();
    const songCount = await page.getByTestId("playlist-song").count();
    expect(songCount).toBe(7);
  });

  test("Scenario 2: Existing playlist duplicate handling", async ({ page }) => {
    // Switch to "All" view to get deterministic alphabetical sorting
    await page.getByText("Albums").click();
    await page.getByText("All").click();

    // 1. Create playlist - click on "Hunted" album (alphabetically first, has 5 songs)
    const huntedAlbum = page.getByTestId("album").first();
    await huntedAlbum.click();
    await page.getByTestId("play-all").click();

    // Track API calls
    const apiCalls: string[] = [];
    page.on("request", (req) => {
      if (req.url().includes("/add")) apiCalls.push(req.url());
    });

    // 2. Add album tracks (navigate back and click same album)
    await page.getByText("Albums").click();
    await page.getByText("All").click();
    await huntedAlbum.click();
    await page.getByTestId("queue-all").click();

    // 3. Add same album tracks again
    await page.getByTestId("queue-all").click();

    // Asserts
    expect(apiCalls.length).toBe(0); // No API calls made when all tracks are duplicates

    // Verify notification on failure (triggered by duplicate add)
    const notification = await page.evaluate(
      () => (window as any).__lastNotification
    );
    expect(notification.title).toBe("Duplicate Tracks");

    // Verify playlist count (5 unique songs from Hunted album)
    await expect(page.getByTestId("playlist-song").first()).toBeVisible();
    const songCount = await page.getByTestId("playlist-song").count();
    expect(songCount).toBe(5);
  });
});
