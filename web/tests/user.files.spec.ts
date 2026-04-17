import { expect, test } from "@playwright/test";

test.afterEach(async ({ page }) => {
  // Clean up playlist state so other tests aren't affected
  await page.goto("/");
  try {
    await page.getByTestId("clear-playlist").click({ force: true });
  } catch {
    // clear button might not be visible on files view
  }
});

test("can expand directories", async ({ page }) => {
  await page.goto("/");
  await page
    .getByTestId("node")
    .filter({ hasText: "Khemmis" })
    .getByTestId("toggle")
    .click();
  await page
    .getByTestId("node")
    .filter({ hasText: "Hunted" })
    .click({ clickCount: 2 });
  await expect(page.getByText("Three Gates")).toBeVisible();
});

test("can filter content", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Tobokegao")).toBeVisible();
  await page.getByPlaceholder("filter").fill("Hunted");
  await expect(page.getByText("Tobokegao")).not.toBeVisible();
});

test("can double click to queue a song", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("clear-playlist").click({ force: true });
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
  await page.getByText("Three Gates").click({ clickCount: 2 });
  await expect(page.getByTestId("playlist-song")).toHaveCount(1);
});


