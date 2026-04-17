import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("sidebar").getByTestId("albums").click();
  await page.getByTestId("clear-playlist").click({ force: true });
});

test.afterEach(async ({ page }) => {
  // Clean up playlist state so other tests aren't affected
  await page.goto("/");
  await page.getByTestId("clear-playlist").click({ force: true });
});

test("can see albums", async ({ page }) => {
  await expect(page.getByTestId("album")).toHaveCount(3);
});

test("can play album", async ({ page }) => {
  await page
    .getByTestId("album")
    .filter({ hasText: "Hunted" })
    .getByTestId("album-art")
    .click({ force: true });
  await page.getByTestId("play-all").click();
  await expect(page.getByTestId("playlist-song")).toHaveCount(5);
});

test("can queue album", async ({ page }) => {
  const album = page.getByTestId("album").filter({ hasText: "Hunted" });
  await album.getByTestId("album-art").click({ force: true });

  // Test play-all
  await page.getByTestId("play-all").click();
  await expect(page.getByTestId("playlist-song")).toHaveCount(5);

  // Test clear
  await page.getByTestId("clear-playlist").click({ force: true });
  await expect(page.getByTestId("playlist-song")).toHaveCount(0);

  // Test queue-all
  await page.getByTestId("queue-all").click();
  await expect(page.getByTestId("playlist-song")).toHaveCount(5);
});

test("can double click track to play", async ({ page }) => {
  await page
    .getByTestId("album")
    .filter({ hasText: "Hunted" })
    .getByTestId("album-art")
    .click({ force: true });
  await page.getByText("Three Gates").click({ clickCount: 2 });
  await expect(
    page.getByTestId("playlist-song").getByText("Three Gates")
  ).toBeVisible();
});


