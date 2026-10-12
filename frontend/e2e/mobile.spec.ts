import { expect, test } from '@playwright/test'

// iPhone и iPad (WebKit, как Safari): страница не шире экрана, поля не вызывают автозум iOS,
// карточки переворачиваются без «просвечивания» оборотной стороны.

const ROUTES = [
  '/', '/course', '/level/a1', '/level/a1/unit/1', '/level/a1/unit/1?tab=cards', '/level/a1/unit/1?tab=practice',
  '/level/b1/grammar/past-perfect', '/level/c1/dialogue/c1-ai-debate', '/level/b2/reading/12', '/grammar',
  '/grammar/tenses', '/grammar/irregular', '/reading', '/speaking', '/words', '/my-words', '/review', '/games',
  '/games/crossword', '/games/wordsearch', '/tests', '/tests/placement', '/profile', '/about',
]

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.locator('#pname').fill('Phone')
  await page.getByRole('button', { name: /Создать профиль|Create profile/ }).click()
  await expect(page.locator('main.content')).toBeVisible()
})

test('pages fit the screen and inputs do not trigger iOS zoom', async ({ page }) => {
  for (const r of ROUTES) {
    await page.goto(`/#${r}`)
    await expect(page.locator('.loader'), r).toHaveCount(0, { timeout: 20_000 })
    const m = await page.evaluate(() => ({
      scroll: document.documentElement.scrollWidth,
      vw: document.documentElement.clientWidth,
      small: [...document.querySelectorAll<HTMLElement>('input:not([type=checkbox]):not([type=radio]):not([type=range]), select, textarea')]
        .filter((e) => e.offsetParent && parseFloat(getComputedStyle(e).fontSize) < 16).length,
      noZoom: /maximum-scale=1/.test(document.querySelector('meta[name=viewport]')?.getAttribute('content') ?? ''),
    }))
    expect(m.scroll, `${r}: страница шире экрана`).toBeLessThanOrEqual(m.vw)
    // мелкие клетки кроссворда допустимы: автозум отключён в meta viewport
    if (!r.includes('crossword')) expect(m.small, `${r}: поля меньше 16px`).toBe(0)
    expect(m.noZoom).toBe(true)
  }
})

test('flashcard shows only the front, then only the back', async ({ page }) => {
  await page.goto('/#/level/a1/unit/1?tab=cards')
  const front = page.locator('.flash-face.front')
  const back = page.locator('.flash-face.back')
  await expect(front).toBeVisible()
  await expect(back).toBeHidden()
  await page.getByRole('button', { name: /Показать ответ|Show answer/ }).click()
  await expect(back).toBeVisible()
  await expect(front).toBeHidden()
})
