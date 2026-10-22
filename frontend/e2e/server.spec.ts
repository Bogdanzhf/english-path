import { expect, test } from '@playwright/test'

// Версия с сервером: регистрация, вход, сохранение прогресса в базе (временной, только для тестов).

const user = { name: `e2e${Date.now() % 100000}`, password: 'violet-river-lantern-42' }

test('register, save progress, log out and log back in', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: /^(Регистрация|Create account)$/ }).click()
  await page.locator('#username').fill(user.name)
  await page.locator('#password').fill(user.password)
  await page.locator('#password2').fill(user.password)
  await page.getByRole('button', { name: /Зарегистрироваться|Sign up/ }).click()
  await expect(page.locator('main.content')).toBeVisible()

  await page.goto('/level/a1/unit/1')
  const star = page.locator('.word-card button[aria-pressed], button[aria-pressed]').first()
  await star.click()
  await expect(star).toHaveAttribute('aria-pressed', 'true')

  // прогресс сохранён на сервере
  await expect
    .poll(async () =>
      page.evaluate(async () => {
        const r = await fetch('/api/progress')
        return (await r.json()).words?.['a1.01.adult']?.in_dict ?? false
      }),
    )
    .toBe(true)

  // выход и повторный вход
  await page.context().clearCookies()
  await page.goto('/')
  await page.locator('#username').fill(user.name)
  await page.locator('#password').fill(user.password)
  await page.getByRole('button', { name: /^(Войти|Sign in)$/ }).last().click()
  await expect(page.locator('main.content')).toBeVisible()
  await page.goto('/my-words')
  await expect(page.getByText('adult').first()).toBeVisible()
})

test('wrong password shows an error', async ({ page }) => {
  await page.goto('/')
  await page.locator('#username').fill('nobody-here')
  await page.locator('#password').fill('wrong-password-123')
  await page.getByRole('button', { name: /^(Войти|Sign in)$/ }).last().click()
  await expect(page.locator('.alert.error')).toBeVisible()
})
