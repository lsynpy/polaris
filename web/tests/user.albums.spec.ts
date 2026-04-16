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

test("can drag album to playlist", async ({ page }) => {
  const albumArt = await page
    .getByTestId("album")
    .filter({ hasText: "Hunted" })
    .getByTestId("album-art");
  await albumArt.dragTo(page.getByTestId("playlist-songs"), { force: true });
  await expect(page.getByTestId("playlist-song")).toHaveCount(5);
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

test("can drag and drop track to playlist", async ({ page }) => {
  await page
    .getByTestId("album")
    .filter({ hasText: "Hunted" })
    .getByTestId("album-art")
    .click({ force: true });
  await page
    .getByText("Three Gates")
    .dragTo(page.getByTestId("playlist-songs"));
  await expect(
    page.getByTestId("playlist-song").getByText("Three Gates")
  ).toBeVisible();
});

test("can drag and drop multiple tracks to playlist", async ({ page }) => {
  await page
    .getByTestId("album")
    .filter({ hasText: "Hunted" })
    .getByTestId("album-art")
    .click({ force: true });
  await page.getByText("Above The Water").click();
  await page.getByText("Three Gates").click({ modifiers: ["Shift"] });
  await page
    .getByText("Three Gates")
    .dragTo(page.getByTestId("playlist-songs"));
  await expect(page.getByTestId("playlist-song")).toHaveCount(3);
});

test("can drag and drop album art to playlist", async ({ page }) => {
  await page
    .getByTestId("album")
    .filter({ hasText: "Hunted" })
    .getByTestId("album-art")
    .click({ force: true });
  await expect(page.getByText("Hunted (2016)")).toBeVisible();
  await expect(page.locator(".cursor-grab").first()).toBeVisible();
  await page
    .locator(".cursor-grab")
    .first()
    .dragTo(page.getByTestId("playlist-songs"), { force: true });
  await expect(page.getByTestId("playlist-song")).toHaveCount(5);
});
