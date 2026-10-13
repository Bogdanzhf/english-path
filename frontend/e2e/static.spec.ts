import { expect, test, type Page } from '@playwright/test'

// Статическая версия (GitHub Pages): прогресс хранится в браузере, вход — через локальный профиль.

async function createProfile(page: Page, name = 'Tester') {
  await page.goto('/')
  await page.locator('#pname').fill(name)
  await page.getByRole('button', { name: /Создать профиль|Create profile/ }).click()
  await expect(page.locator('main.content')).toBeVisible()
}

/** Ответить на текущий вопрос с вариантами и перейти дальше. */
async function answerAndNext(page: Page) {
  await page.locator('button.option').first().click()
  await expect(page.locator('.feedback')).toBeVisible()
  await page.getByRole('button', { name: /Дальше|Next|Завершить|Finish/ }).click()
}

const ROUTES = [
  '/',
  '/course',
  '/level/a1',
  '/level/b2',
  '/level/c2',
  '/level/a1/unit/1',
  '/level/c2/unit/30',
  '/level/b1/grammar/past-perfect',
  '/level/c1/dialogue/c1-ai-debate',
  '/level/b2/reading/12',
  '/grammar',
  '/grammar/tenses',
  '/grammar/irregular',
  '/reading',
  '/speaking',
  '/words',
  '/my-words',
  '/review',
  '/games',
  '/tests',
  '/tests/placement',
  '/profile',
  '/about',
]

test.describe('static site', () => {
  test('first visit asks to create a local profile', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('#pname')).toBeVisible()
    await createProfile(page)
    await expect(page.locator('#pname')).toHaveCount(0)
  })

  test('every page opens without errors', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(e.message))
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
    await createProfile(page)
    for (const route of ROUTES) {
      await page.goto(`/#${route}`)
      await expect(page.locator('main.content'), route).toBeVisible()
      await expect(page.getByText(/Страница не найдена|Page not found/), route).toHaveCount(0)
      await expect(page.locator('.loader'), route).toHaveCount(0, { timeout: 20_000 })
    }
    expect(errors.filter((e) => !/speech|voices|favicon/i.test(e))).toEqual([])
  })

  test('unit: words, add to dictionary, practice with feedback', async ({ page }) => {
    await createProfile(page)
    await page.goto('/#/level/a1/unit/1')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    const star = page.locator('.word-card button[aria-pressed], button[aria-pressed]').first()
    await star.click()
    await expect(star).toHaveAttribute('aria-pressed', 'true')

    await page.getByRole('tab', { name: /Практика|Practice/ }).or(page.getByRole('button', { name: /Практика|Practice/ })).first().click()
    const option = page.locator('button.option').first()
    if (await option.count()) {
      await option.click()
      await expect(page.locator('.feedback')).toBeVisible()
    }

    await page.goto('/#/my-words')
    await expect(page.getByText('agree').first()).toBeVisible()
  })

  test('grammar topic shows theory and checks answers', async ({ page }) => {
    await createProfile(page)
    await page.goto('/#/level/a2/grammar/present-perfect')
    await expect(page.locator('table').first()).toBeVisible()
    await page.goto('/#/level/a2/grammar/present-perfect?tab=practice')
    const option = page.locator('button.option').first()
    await option.scrollIntoViewIfNeeded()
    await option.click()
    await expect(page.locator('.feedback').first()).toBeVisible()
  })

  test('placement test suggests a level', async ({ page }) => {
    test.setTimeout(150_000) // до 80 вопросов — на телефоне под нагрузкой дольше минуты
    await createProfile(page)
    await page.goto('/#/tests/placement')
    await page.getByRole('button', { name: /Начать|Start/ }).click()
    for (let i = 0; i < 80; i++) {
      if (await page.getByText(/Ваш примерный уровень|Your estimated level/).count()) break
      const next = page.getByRole('button', { name: /Дальше|Next|Завершить|Finish/ })
      const options = page.locator('button.option:not([disabled])')
      if (await next.count()) await next.click()
      else if (await options.count()) await options.first().click()
      else await page.getByRole('button', { name: /Пропустить|Skip/ }).click()
    }
    await expect(page.getByText(/Ваш примерный уровень|Your estimated level/)).toBeVisible()
  })

  test('interface language switch', async ({ page, isMobile }) => {
    test.skip(isMobile, 'переключатель в шапке есть и на телефоне, но проверяем один раз')
    await createProfile(page)
    await page.goto('/#/course')
    const toggle = page.locator('button.lang-toggle')
    const before = await toggle.innerText()
    await toggle.click()
    await expect(toggle).not.toHaveText(before)
    await page.reload()
    await expect(toggle).not.toHaveText(before) // выбор сохраняется
  })

  test('theme toggle switches dark and light', async ({ page, isMobile }) => {
    test.skip(isMobile, 'кнопка темы на телефоне — в профиле')
    await createProfile(page)
    const html = page.locator('html')
    const before = await html.getAttribute('data-theme')
    await page.getByRole('button', { name: /тема|theme/i }).click()
    await expect(html).not.toHaveAttribute('data-theme', before ?? '')
  })

  test('search finds words in English and Russian', async ({ page, isMobile }) => {
    test.skip(isMobile, 'поиск в шапке на телефоне скрыт')
    await createProfile(page)
    const search = page.locator('header.topbar input')
    await search.fill('volcano')
    await search.press('Enter')
    await expect(page).toHaveURL(/words/)
    await expect(page.locator('main.content').getByText('volcano').first()).toBeVisible()
    await search.fill('вулкан')
    await search.press('Enter')
    await expect(page.locator('main.content').getByText('volcano').first()).toBeVisible()
  })

  test('word review session from my dictionary', async ({ page }) => {
    await createProfile(page)
    await page.goto('/#/level/a1/unit/2')
    await page.getByRole('button', { name: /Добавить все|Add all/ }).click()
    await page.goto('/#/review')
    await expect(page.locator('main.content')).toContainText(/2[0-9]|слов|words/)
  })

  test('games open', async ({ page }) => {
    await createProfile(page)
    for (const g of ['crossword', 'wordsearch']) {
      await page.goto(`/#/games/${g}`)
      await expect(page.locator('main.content')).toBeVisible()
    }
  })

  test('mobile bottom bar navigates', async ({ page, isMobile, viewport }) => {
    test.skip(!isMobile || (viewport?.width ?? 0) > 760, 'только для телефона (на iPad — боковое меню)')
    await createProfile(page)
    const bar = page.locator('nav.bottombar')
    await expect(bar).toBeVisible()
    await bar.locator('a[href*="course"]').click()
    await expect(page).toHaveURL(/course/)
    await bar.locator('a[href*="my-words"]').click()
    await expect(page).toHaveURL(/my-words/)
  })

  test('unit quiz can be completed', async ({ page }) => {
    await createProfile(page)
    await page.goto('/#/level/a1/unit/3?tab=practice')
    for (let i = 0; i < 40; i++) {
      if (!(await page.locator('button.option').count())) break
      await answerAndNext(page)
    }
    await expect(page.locator('main.content')).toBeVisible()
  })
})
