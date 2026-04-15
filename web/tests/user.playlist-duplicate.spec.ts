import { expect, test } from "@playwright/test";

test("Silently ignores duplicate tracks when saving", async ({ page }) => {
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
  await page.getByLabel("Playlist Name").fill("Duplicate Test Playlist");
  await page.getByTestId("submit-save-playlist").click();

  // Verify successful save: wait for dialog to close and check playlist contents
  await expect(page.locator("form")).not.toBeVisible();

  await page.getByTestId("sidebar").getByTestId("playlists").click();
  await page
    .getByTestId("saved-playlist")
    .getByText("Duplicate Test Playlist")
    .click();

  // Verify only 5 unique songs were saved
  await expect(
    page
      .getByTestId("saved-playlist-songs")
      .getByTestId("song")
      .locator("visible=true")
  ).toHaveCount(5);
});
