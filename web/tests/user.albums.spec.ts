import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('sidebar').getByTestId('albums').click();
  await page.getByTestId('clear-playlist').click({ force: true });
});

test.afterEach(async ({ page }) => {
  // Clean up playlist state so other tests aren't affected
  await page.goto('/');
  await page.getByTestId('clear-playlist').click({ force: true });
});

test('[Album] play-all btn, queue-all btn', async ({ page }) => {
  await expect(page.getByTestId('album')).toHaveCount(3);
  // play-all
  await page
    .getByTestId('album')
    .filter({ hasText: 'Hunted' })
    .getByTestId('album-art')
    .click({ force: true });
  await page.getByTestId('play-all').click();
  await expect(page.getByTestId('playlist-song')).toHaveCount(5);
  // clear
  await page.getByTestId('clear-playlist').click({ force: true });
  await expect(page.getByTestId('playlist-song')).toHaveCount(0);
  // Test queue-all
  await page.getByTestId('queue-all').click();
  await expect(page.getByTestId('playlist-song')).toHaveCount(5);
});

test('[Album] play menu, queue menu', async ({ page }) => {
  await expect(page.getByTestId('album')).toHaveCount(3);
  // play menu
  // clear
  // queue menu
});
