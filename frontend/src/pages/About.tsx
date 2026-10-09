import { PageHead } from '../components/ui'
import { useI18n } from '../i18n'

export default function About() {
  const { t, lang } = useI18n()
  return (
    <div style={{ maxWidth: 760 }}>
      <PageHead title={t('about_title')} />
      <div className="card md">
        {lang === 'ru' ? (
          <>
            <p>
              <b>English Path</b> — личная платформа для изучения английского от A1 до C2. Списки слов и темы юнитов
              следуют серии учебников <i>4000 Essential English Words</i> (книги 1–6); определения, примеры, тексты,
              диалоги, упражнения и курс грамматики написаны заново для этого сайта. Материалы самих книг в проект не входят.
            </p>
            <h3>Озвучка</h3>
            <p>Слова, примеры, тексты и диалоги озвучены нейроголосами Microsoft (британский и американский акцент). Если файла нет, работает голос вашего устройства.</p>
            <h3>Картинки</h3>
            <p>3D-иллюстрации — Microsoft Fluent Emoji (лицензия MIT).</p>
            <h3>Распознавание речи</h3>
            <p>Упражнения на говорение используют встроенное в браузер распознавание речи (Chrome, Edge, Safari).</p>
          </>
        ) : (
          <>
            <p>
              <b>English Path</b> is a personal platform for learning English from A1 to C2. Word lists and unit topics follow
              the <i>4000 Essential English Words</i> series (books 1–6); definitions, examples, texts, dialogues, exercises and
              the grammar course were written from scratch for this site. No material from the books themselves is included.
            </p>
            <h3>Audio</h3>
            <p>Words, examples, texts and dialogues are voiced by Microsoft neural voices (British and American). If a file is missing, your device voice is used.</p>
            <h3>Images</h3>
            <p>3D illustrations — Microsoft Fluent Emoji (MIT license).</p>
            <h3>Speech recognition</h3>
            <p>Speaking exercises use the browser’s built-in speech recognition (Chrome, Edge, Safari).</p>
          </>
        )}
      </div>
    </div>
  )
}
