import { test, expect } from '@playwright/test';

test.describe('@smoke Auth flow', () => {
  test('login page renders', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: 'SincVete' })).toBeVisible();
    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByLabel('Contraseña')).toBeVisible();
  });

  test('register page renders', async ({ page }) => {
    await page.goto('/register');
    await expect(page.getByRole('heading', { name: /Registrá SincVete/ })).toBeVisible();
    await expect(page.getByLabel('Nombre de la clínica')).toBeVisible();
  });

  test('redirects unauthenticated users to login', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe('@smoke Command palette', () => {
  test('propietarios redirects unauthenticated users', async ({ page }) => {
    await page.goto('/propietarios');
    await expect(page).toHaveURL(/\/login/);
  });
});
