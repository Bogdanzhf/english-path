# Формат учебного контента

Контент проверяется при экспорте и в тестах (`poetry run pytest`): ошибка в файле остановит сборку
с понятным сообщением. После правки пересоберите данные и озвучку:

```bash
cd backend && poetry run python -m app.export && cd ..
poetry run python tools/build_audio.py      # озвучить новые фразы
cd backend && poetry run python -m app.export  # подхватить готовые mp3
```

```
content/
  vocab/<уровень>/uNN.yaml     # юнит слов: 20 слов + текст для чтения (уровни a1 … c2)
  grammar/<уровень>/NN-id.yaml # тема грамматики
  dialogues/<уровень>.yaml     # диалоги уровня
  placement.yaml               # тест на определение уровня
  irregular_verbs.yaml         # неправильные глаголы
  images.yaml                  # картинки к словам (пишет tools/build_images.py)
```

Списки слов юнитов соответствуют серии *4000 Essential English Words* (книга N = уровень N).
Определения, примеры, тексты и упражнения написаны заново.

## Юнит слов: `vocab/a1/u01.yaml`

```yaml
title: "Holidays and Travel"
title_ru: "Отдых и путешествия"
words:
  # слово | часть речи | IPA брит. | IPA амер. (пусто = как брит.) | перевод | определение | пример | перевод примера | заметка (необяз.)
  - "arrive | v | əˈraɪv | | прибывать | to reach a place at the end of a trip | Our train will *arrive* at six. | Наш поезд прибудет в шесть. | arrive at / arrive in"
reading:
  title: "A Week on the Coast"
  title_ru: "Неделя на побережье"
  text: |
    Абзацы английского текста разделяются пустой строкой.

    Второй абзац.
  ru: |
    Перевод — столько же абзацев.

    Второй абзац.
  questions:
    - q: "When do they travel?"
      options: ["In July", "In August"]
      answer: 1            # индекс верного варианта
    - tf: "Leo caught a lot of fish."
      answer: false
exercises: []              # необязательные дополнительные упражнения (любые типы ниже)
```

Части речи: `n v adj adv prep conj pron phr phv num det interj`.
В примере слово выделяется звёздочками `*word*` (в той форме, в какой оно стоит в предложении) —
из него генерируются упражнения «вставьте слово». Слова юнита в тексте подсвечиваются автоматически.

## Тема грамматики: `grammar/a1/01-to-be.yaml`

Имя файла: номер (порядок в уровне) и id темы.

```yaml
title: "The verb to be"
title_ru: "Глагол to be"
section: verbs     # tenses verbs modals nouns adjectives pronouns prepositions sentences
                   # conditionals passive reported clauses style words
summary: "…"
summary_ru: "…"
theory: |          # правило на английском (Markdown: ## заголовки, таблицы, > подсказки)
theory_ru: |       # правило на русском
examples:
  - "I *am* a student. | Я студент."
exercises: [...]   # не меньше 6
```

## Упражнения

Общие необязательные поля: `task` / `task_ru` (своя формулировка задания), `explain` / `explain_ru`
(пояснение после ответа), `audio` (фраза для прослушивания), `img`.

```yaml
- type: choice              # выбор варианта (odd — «найди лишнее», так же)
  q: "My name ___ Alex."
  options: ["am", "is", "are"]
  answer: 1
- type: input               # ввод; сокращения (don't = do not) засчитываются автоматически
  q: "They ___ (not / be) at home."
  answer: ["aren't", "are not"]
- type: order               # собрать предложение из слов
  q: "Составьте: «Ты устал?»"
  answer: "Are you tired?"
- type: match
  pairs: [["I", "am"], ["she", "is"]]
- type: cloze               # [[ответ|вариант]] — ввод, [[a/*b/c]] — выпадающий список, * — верный
  text: "I [[am|'m]] Kate. She [[is/*are/am]] …"
- type: error               # одно неверное слово {{неверно=>верно}}
  text: "My friends {{is=>are}} kind."
- type: tf
  items: [["Statement", true], ["Statement", false]]
- type: dialog              # реплики в правильном порядке (перемешиваются)
  lines: ["Hi!", "Hello!", "How are you?"]
- type: listen              # прослушать audio и выбрать (options) или написать (answer)
  audio: "Are you from Spain?"
  options: ["Spain", "Italy"]
  answer: 0
- type: speak               # произнести фразу (распознавание речи)
  answer: "I am a student."
  ru: "Я студент."
```

## Письмо (в теме грамматики)

Блок `writing:` в конце темы — задания на свои предложения, по одному в строке (части через ` | `,
варианты ответа через `||`). Сокращения (I'm = I am, don't = do not) и регистр при проверке не важны.

```yaml
writing:
  - "translate | Я живу здесь с 2019 года. | I have lived here since 2019. || I've been living here since 2019."
  - "transform | Сделайте отрицательным | She works on Sundays. | She doesn't work on Sundays."
  - "transform! | Поставьте точку с запятой | It was late, we went home. | It was late; we went home."
  - "compose | Напишите о своих выходных | usually | I usually sleep late on Saturdays."
  - "complete | Что бы вы сделали? | If I had more time, | If I had more time, I would learn to draw."
```

- `translate` — перевод с русского; `transform` — что сделать + исходное предложение + ответ;
  `transform!` — то же, но знаки препинания тоже проверяются (тема «Пунктуация»);
- `compose` — о чём написать + обязательные слова через запятую (`-` — без них) + образец;
- `complete` — о чём написать + начало предложения + образец (начинается с этого начала).

Примеры темы (`examples`) тоже превращаются в задания: перевод и порядок слов. В юнитах «Письмо»
строится автоматически из слов: перевод примера, своё предложение со словом, порядок слов.

## Диалоги: `dialogues/a1.yaml`

```yaml
- id: a1-nice-to-meet-you
  title: "Nice to meet you"
  title_ru: "Приятно познакомиться"
  scene: "…"
  scene_ru: "…"
  speakers: {Emma: f-uk, Daniel: m-us}   # голоса: f-us m-us f-uk m-uk f-au m-au
  lines:
    - "Emma: Hi! Is this seat free? | Привет! Здесь свободно?"
  phrases:
    - "Nice to meet you. | Приятно познакомиться."
  exercises: [...]
```

## Тест на уровень: `placement.yaml`

Список упражнений (любого типа) с полем `level: a1 … c2`.

## Неправильные глаголы: `irregular_verbs.yaml`

```yaml
- "go | went | gone | идти, ехать | a1"   # формы через / — равноправные варианты: was/were
```
