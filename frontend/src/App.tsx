import { lazy, Suspense, type ReactNode } from 'react'
import { BrowserRouter, HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Layout, Toasts } from './components/Layout'
import { Empty, Loader } from './components/ui'
import { useI18n } from './i18n'
import { MODE } from './lib/store'
import Dashboard from './pages/Dashboard'
import Login from './pages/Login'
import { useApp } from './state'

// крупные разделы загружаются по требованию — первый экран открывается быстрее
const Course = lazy(() => import('./pages/Course'))
const Level = lazy(() => import('./pages/Level'))
const Unit = lazy(() => import('./pages/Unit'))
const GrammarIndex = lazy(() => import('./pages/GrammarIndex'))
const GrammarTopic = lazy(() => import('./pages/GrammarTopic'))
const Tenses = lazy(() => import('./pages/Tenses'))
const Irregular = lazy(() => import('./pages/Irregular'))
const ReadingIndex = lazy(() => import('./pages/ReadingIndex'))
const ReadingPage = lazy(() => import('./pages/ReadingPage'))
const Speaking = lazy(() => import('./pages/Speaking'))
const DialoguePage = lazy(() => import('./pages/DialoguePage'))
const Words = lazy(() => import('./pages/Words'))
const MyWords = lazy(() => import('./pages/MyWords'))
const Review = lazy(() => import('./pages/Review'))
const Games = lazy(() => import('./pages/Games'))
const Tests = lazy(() => import('./pages/Tests'))
const Placement = lazy(() => import('./pages/Placement'))
const Profile = lazy(() => import('./pages/Profile'))
const About = lazy(() => import('./pages/About'))

const Router = MODE === 'local' ? HashRouter : BrowserRouter

function NotFound() {
  const { t } = useI18n()
  return <Empty emoji="🧭">{t('not_found')}</Empty>
}

function Page({ children }: { children: ReactNode }) {
  return <Suspense fallback={<Loader />}>{children}</Suspense>
}

export default function App() {
  const { ready, user, error } = useApp()
  const { t } = useI18n()
  if (!ready) return <Loader />
  if (error) {
    return (
      <div className="empty">
        <div className="emoji">📡</div>
        <h2>{t('error_title')}</h2>
        <p className="muted">{String((error as Error).message ?? error)}</p>
        <button className="btn btn-primary" onClick={() => location.reload()}>
          {t('error_reload')}
        </button>
      </div>
    )
  }
  return (
    <Router>
      {!user ? (
        <Routes>
          <Route path="*" element={<Login />} />
        </Routes>
      ) : (
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="course" element={<Page><Course /></Page>} />
            <Route path="level/:lv" element={<Page><Level /></Page>} />
            <Route path="level/:lv/unit/:num" element={<Page><Unit /></Page>} />
            <Route path="level/:lv/grammar/:id" element={<Page><GrammarTopic /></Page>} />
            <Route path="level/:lv/dialogue/:id" element={<Page><DialoguePage /></Page>} />
            <Route path="level/:lv/reading/:num" element={<Page><ReadingPage /></Page>} />
            <Route path="grammar" element={<Page><GrammarIndex /></Page>} />
            <Route path="grammar/tenses" element={<Page><Tenses /></Page>} />
            <Route path="grammar/irregular" element={<Page><Irregular /></Page>} />
            <Route path="reading" element={<Page><ReadingIndex /></Page>} />
            <Route path="speaking" element={<Page><Speaking /></Page>} />
            <Route path="words" element={<Page><Words /></Page>} />
            <Route path="my-words" element={<Page><MyWords /></Page>} />
            <Route path="review" element={<Page><Review /></Page>} />
            <Route path="games" element={<Page><Games /></Page>} />
            <Route path="games/:game" element={<Page><Games /></Page>} />
            <Route path="tests" element={<Page><Tests /></Page>} />
            <Route path="tests/placement" element={<Page><Placement /></Page>} />
            <Route path="profile" element={<Page><Profile /></Page>} />
            <Route path="about" element={<Page><About /></Page>} />
            <Route path="login" element={<Navigate to="/" replace />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      )}
      <Toasts />
    </Router>
  )
}
