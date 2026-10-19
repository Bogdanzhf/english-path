import { expect, test, type Page } from '@playwright/test'

// Письмо (свои предложения), карточки без подсматривания перевода, выбор слов в тренажёре.

async function createProfile(page: Page) {
  await page.goto('/')
  await page.locator('#pname').fill('Writer')
  await page.getByRole('button', { name: /Создать профиль|Create profile/ }).click()
  await expect(page.locator('main.content')).toBeVisible()
}

/** Оставить в настройках «Письма» только один вид заданий и запустить. */
async function startWriting(page: Page, kind: RegExp, count = '5') {
  const chips = page.locator('.writing-setup button.chip')
  await expect(chips.first()).toBeVisible()
  for (let i = 0; i < (await chips.count()); i++) {
    const chip = chips.nth(i)
    const on = (await chip.getAttribute('aria-pressed')) === 'true'
    if (kind.test(await chip.innerText()) !== on) await chip.click()
  }
  await page.locator('.writing-setup .segmented button', { hasText: new RegExp(`^${count}$`) }).click()
  await page.getByRole('button', { name: /^(Начать|Start)$/ }).click()
}

test.beforeEach(async ({ page }) => createProfile(page))

test('flashcards: the next card never shows its translation in advance', async ({ page }) => {
  await page.goto('/#/level/a1/unit/1?tab=cards')
  for (let i = 0; i < 3; i++) {
    await page.getByRole('button', { name: /Показать ответ|Show answer/ }).click()
    await expect(page.locator('.flashcard')).toHaveClass(/flipped/)
    await page.getByRole('button', { name: /^(Знаю|I know it)$/ }).click()
    // сразу после оценки: лицевая сторона, оборот (перевод) скрыт без анимации
    await expect(page.locator('.flashcard')).not.toHaveClass(/flipped/, { timeout: 100 })
    await expect(page.locator('.flash-face.back')).toBeHidden({ timeout: 100 })
  }
})

test('unit writing: translate an example and write an own sentence', async ({ page }) => {
  const words: { w: string; ex: string; exRu: string }[] = await (await page.request.get('/data/words.json')).json()
  await page.goto('/#/level/a1/unit/2?tab=writing')
  await startWriting(page, /Перевод|Translation/, '5')
  for (let i = 0; i < 5; i++) {
    const q = (await page.locator('.ex-q').innerText()).trim()
    const word = words.find((w) => w.exRu === q)
    expect(word, q).toBeTruthy()
    await page.locator('textarea.sentence-box').fill(word!.ex.replace(/\*/g, '').replace("I am", "I'm"))
    await page.getByRole('button', { name: /^(Проверить|Check)$/ }).click()
    await expect(page.locator('.write-result.ok')).toBeVisible()
    await page.getByRole('button', { name: /Дальше|Next|Завершить|Finish/ }).click()
  }
  await expect(page.getByText(/5\s*\/\s*5|100\s*%/).first()).toBeVisible()

  await page.getByRole('button', { name: /Настройки|Settings/ }).click()
  await startWriting(page, /Своё предложение|Own sentence/, '5')
  const word = (await page.locator('.ex-q strong').first().innerText()).trim()
  await page.locator('textarea.sentence-box').fill('Hi')
  await page.getByRole('button', { name: /^(Проверить|Check)$/ }).click()
  await expect(page.locator('.alert.warn')).toBeVisible() // слишком коротко и без слова
  await page.locator('textarea.sentence-box').fill(`I think the word ${word} is really useful in my life.`)
  await page.getByRole('button', { name: /^(Проверить|Check)$/ }).click()
  await expect(page.locator('.write-result.ok')).toBeVisible()
})

test('grammar writing: a wrong transformation shows the difference and can be self-credited', async ({ page }) => {
  await page.goto('/#/level/a1/grammar/to-be?tab=writing')
  await startWriting(page, /Трансформация|Transformation/, '5')
  await page.locator('textarea.sentence-box').fill('Something completely different here')
  await page.getByRole('button', { name: /^(Проверить|Check)$/ }).click()
  await expect(page.locator('.diff')).toBeVisible()
  await expect(page.locator('.diff-missing').first()).toBeVisible()
  await page.getByRole('button', { name: /Мой вариант тоже верный|Mine is correct too/ }).click()
  await expect(page.locator('.feedback.ok')).toBeVisible()
})

test('trainer: pick specific words from the whole course and practise them', async ({ page }) => {
  await page.goto('/#/review?source=pick')
  await page.locator('.word-picker .segmented button', { hasText: /Весь курс|Whole course/ }).click()
  await page.getByPlaceholder(/Найти слово в списке|Find a word/).fill('volcano')
  await page.locator('.pick-row', { hasText: 'volcano' }).first().click()
  await expect(page.getByText(/Выбрано: 1|Selected: 1/)).toBeVisible()
  await page.getByRole('button', { name: /Письмо: своё предложение|Writing: own sentence/ }).click()
  await expect(page.locator('.ex-q strong')).toHaveText('volcano')
  await page.locator('textarea.sentence-box').fill('We climbed an old volcano last summer.')
  await page.getByRole('button', { name: /^(Проверить|Check)$/ }).click()
  await expect(page.locator('.write-result.ok')).toBeVisible()

  // выбор запоминается и после перезагрузки страницы
  await page.reload()
  await expect(page.getByText(/Выбрано: 1|Selected: 1/)).toBeVisible()
})
