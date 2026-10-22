import { expect, test, type Page } from '@playwright/test'

// Полный обход курса: каждая ссылка на уровнях открывается, количество слов на карточке урока
// совпадает с фактическим, а карточки проходятся до конца (все слова урока, без сброса на середине).

const LEVELS = ['a1', 'a2', 'b1', 'b2', 'c1', 'c2']

async function createProfile(page: Page) {
  await page.goto('/')
  await page.locator('#pname').fill('Crawler')
  await page.getByRole('button', { name: /Создать профиль|Create profile/ }).click()
  await expect(page.locator('main.content')).toBeVisible()
}

async function expectPageOk(page: Page, route: string) {
  await expect(page.locator('main.content'), route).toBeVisible()
  await expect(page.locator('.loader'), route).toHaveCount(0, { timeout: 20_000 })
  await expect(page.getByText(/Страница не найдена|Page not found/), route).toHaveCount(0)
  await expect(page.locator('main.content :is(h1, h2)').first(), route).toBeVisible()
}

async function hrefs(page: Page, tab: string, pattern: RegExp) {
  await page.goto(`/#/level/${page.url().match(/level\/(\w\w)/)![1]}?tab=${tab}`)
  await expect(page.locator('.loader')).toHaveCount(0, { timeout: 20_000 })
  const all = await page.locator('main.content a[href]').evaluateAll((els) => els.map((e) => e.getAttribute('href') ?? ''))
  return [...new Set(all.filter((h) => pattern.test(h)))]
}

test.describe('course crawl', () => {
  test.skip(({ isMobile }) => isMobile, 'обход один раз, на компьютере')
  test.setTimeout(1_800_000) // v2: до 150 уроков на уровень

  for (const lv of LEVELS) {
    test(`level ${lv}: every unit, reading, grammar topic and dialogue opens`, async ({ page }) => {
      const errors: string[] = []
      page.on('pageerror', (e) => errors.push(e.message))
      await createProfile(page)
      await page.goto(`/#/level/${lv}`)

      // уроки (v2: тематические, 35–151 на уровень): число на карточке = числу карточек слов на странице
      await expect(page.locator('a.unit-card').first()).toBeVisible()
      const units = await page.locator('a.unit-card').evaluateAll((els) =>
        els.map((e) => ({ href: e.getAttribute('href') ?? '', n: Number(/(\d+)\s+(слов|word)/.exec(e.querySelector('.muted')?.textContent ?? '')?.[1]) })),
      )
      expect(units.length).toBeGreaterThanOrEqual(30)
      for (const u of units) {
        await page.goto('/' + u.href)
        await expectPageOk(page, u.href)
        await expect(page.locator('article.word-card'), u.href).toHaveCount(u.n)
        expect(u.n, u.href).toBeGreaterThanOrEqual(8)
      }

      await page.goto(`/#/level/${lv}`)
      const readings = await hrefs(page, 'reading', /\/reading\/\d+$/)
      const grammar = await hrefs(page, 'grammar', /\/grammar\/[\w-]+$/)
      const dialogues = await hrefs(page, 'dialogues', /\/dialogue\/[\w-]+$/)
      expect(readings).toHaveLength(30)
      expect(grammar.length).toBeGreaterThan(0)
      expect(dialogues).toHaveLength(6)
      for (const h of [...readings, ...grammar, ...dialogues]) {
        await page.goto('/' + h)
        await expectPageOk(page, h)
      }
      expect(errors).toEqual([])
    })
  }

  test('flashcards go through all words of a lesson', async ({ page }) => {
    await createProfile(page)
    await page.goto('/#/level/b1/unit/5?tab=cards')
    const first = page.getByText(/^1\/\d+$/)
    await expect(first).toBeVisible()
    const total = Number((await first.textContent())!.split('/')[1])
    expect(total).toBeGreaterThanOrEqual(8)
    for (let i = 1; i <= total; i++) {
      await expect(page.getByText(`${i}/${total}`, { exact: true })).toBeVisible()
      await page.getByRole('button', { name: /Показать ответ|Show answer/ }).click()
      await page.getByRole('button', { name: i % 3 ? /^(Знаю|I know it)$/ : /Не знаю|I don.t know/ }).click()
    }
    await expect(page.getByRole('button', { name: /Ещё раз|Again|Заново|Restart/ })).toBeVisible()
  })
})
