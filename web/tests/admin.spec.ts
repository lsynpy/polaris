import { expect, test } from '@playwright/test';

test('can set album art pattern', async ({ page }) => {
  const pattern = `test_pattern_${Date.now()}`;
  const putRequest = page.waitForRequest(
    (request) => request.method() === 'PUT' && request.url().endsWith('/api/settings')
  );

  await page.goto('/');
  await page.getByTestId('sidebar').getByTestId('settings').click();
  await page.getByTestId('collection').click();
  await page.getByLabel('album art pattern').fill(pattern);
  await page.getByTestId('apply').click();
  await putRequest;
  await page.reload();
  await expect(page.getByLabel('album art pattern')).toHaveValue(pattern);
});

test('can add and remove mount dir', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('sidebar').getByTestId('settings').click();
  await page.getByTestId('collection').click();

  await page.waitForLoadState('networkidle');

  let existingCount = await page.getByTestId('location').count();

  while (existingCount > 0) {
    await page.getByTestId('delete-source').first().click();

    const deletePutRequest = page.waitForRequest(
      (request) => request.method() === 'PUT' && request.url().endsWith('/api/mount_dirs')
    );
    await page.getByTestId('apply').click();
    await deletePutRequest;

    await page.reload();
    await page.waitForLoadState('networkidle');

    existingCount = await page.getByTestId('location').count();
  }

  await expect(page.getByTestId('location')).toHaveCount(0);

  const location = `/test/location_${Date.now()}`;
  const name = `test_name_${Date.now()}`;

  await page.getByTestId('add-source').click();

  await page.getByTestId('location').getByRole('textbox').last().fill(location);
  await page.getByTestId('name').getByRole('textbox').last().fill(name);

  const addPutRequest = page.waitForRequest(
    (request) => request.method() === 'PUT' && request.url().endsWith('/api/mount_dirs')
  );
  await page.getByTestId('apply').click();
  await addPutRequest;

  await page.reload();
  await page.waitForLoadState('networkidle');

  await expect(page.getByTestId('location')).toHaveCount(1);
  await expect(page.getByTestId('location').getByRole('textbox').last()).toHaveValue(location);
  await expect(page.getByTestId('name').getByRole('textbox').last()).toHaveValue(name);
});

test('can add and remove user', async ({ page }) => {
  const username = `test_${Date.now()}`;
  const password = `test_password_${Date.now()}`;

  await page.goto('/');
  await page.getByTestId('sidebar').getByTestId('settings').click();
  await page.getByTestId('users').click();

  await page.getByTestId('add-user').click();
  await page.getByLabel('username').fill(username);
  await page.getByLabel('password').fill(password);

  const postRequest = page.waitForRequest(
    (request) => request.method() === 'POST' && request.url().endsWith('/api/user')
  );
  await page.getByTestId('create-user').click();
  await postRequest;
  await page.reload();

  await expect(page.getByTestId('user')).toHaveCount(2);
  await expect(page.getByTestId('user').last()).toContainText(username);

  const deleteRequest = page.waitForRequest(
    (request) => request.method() === 'DELETE' && request.url().endsWith(`/api/user/${username}`)
  );
  await page.getByTestId('delete-user').last().click();
  await deleteRequest;
  await page.reload();

  await expect(page.getByTestId('user')).toHaveCount(1);
});
