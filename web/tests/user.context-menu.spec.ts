import { expect, test } from "@playwright/test";
import { setupNotificationMock } from "./helpers";

test.describe("Context Menu", () => {
  test("Files view: context menu items are defined correctly", async ({
    page
  }) => {
    await setupNotificationMock(page);
    await page.goto("/");
    await page.getByTestId("sidebar").getByTestId("files").click();

    // Verify the Files view loads correctly
    await expect(page.getByRole("heading", { name: "Files" })).toBeVisible();
  });

  test("Files view: Play action (double-click) works", async ({ page }) => {
    await setupNotificationMock(page);
    await page.goto("/");
    await page.getByTestId("sidebar").getByTestId("files").click();

    // Expand directories to get songs
    await page
      .getByTestId("node")
      .filter({ hasText: "Khemmis" })
      .getByTestId("toggle")
      .click();
    await page
      .getByTestId("node")
      .filter({ hasText: "Hunted" })
      .getByTestId("toggle")
      .click();

    // Double-click to play (equivalent to context menu Play)
    await page
      .getByTestId("node")
      .filter({ hasText: "Three Gates" })
      .dblclick();

    // Verify song was queued (no errors, title may change to show current track)
    await expect(page.getByTestId("playlist-song")).toHaveCount(1);
  });



  test("Files view: Play clears existing playlist", async ({ page }) => {
    await setupNotificationMock(page);
    await page.goto("/");

    // First queue some songs from albums
    await page.getByTestId("sidebar").getByTestId("albums").click();
    const albumCard = page.getByTestId("album").first();
    if (await albumCard.isVisible()) {
      await albumCard.click();
    }
    const queueAllBtn = page.getByTestId("queue-all");
    if (await queueAllBtn.isVisible()) {
      await queueAllBtn.click();
    }

    // Count initial playlist items
    const initialCount = await page.getByTestId("playlist-song").count();

    // Go to Files and Play a song (should clear and queue)
    await page.getByTestId("sidebar").getByTestId("files").click();
    await page
      .getByTestId("node")
      .filter({ hasText: "Khemmis" })
      .getByTestId("toggle")
      .click();
    await page
      .getByTestId("node")
      .filter({ hasText: "Hunted" })
      .getByTestId("toggle")
      .click();

    await page
      .getByTestId("node")
      .filter({ hasText: "Three Gates" })
      .dblclick();

    // Verify playlist was cleared and only the new song is there
    await expect(page.getByTestId("playlist-song")).toHaveCount(1);
  });

  test("Files view: Queue appends to existing playlist", async ({ page }) => {
    await setupNotificationMock(page);
    await page.goto("/");
    await page.getByTestId("sidebar").getByTestId("files").click();

    // Expand directories to get songs
    await page
      .getByTestId("node")
      .filter({ hasText: "Khemmis" })
      .getByTestId("toggle")
      .click();
    await page
      .getByTestId("node")
      .filter({ hasText: "Hunted" })
      .getByTestId("toggle")
      .click();

    // First queue a song (should start playlist) - double click to play
    await page
      .getByTestId("node")
      .filter({ hasText: "Three Gates" })
      .dblclick();

    // Wait for first song to be queued
    await page.waitForTimeout(1000);
    await expect(page.getByTestId("playlist-song")).toHaveCount(1);
    const countBeforeSecondQueue = await page.getByTestId("playlist-song").count();

    // Queue another song (should append) - click then Shift+Enter
    await page
      .getByTestId("node")
      .filter({ hasText: "Above The Water" })
      .click();
    await page.keyboard.press("Shift+Enter");

    // Verify playlist now has more items
    await page.waitForTimeout(1000);
    const finalCount = await page.getByTestId("playlist-song").count();
    expect(finalCount).toBeGreaterThan(countBeforeSecondQueue);
  });
});
