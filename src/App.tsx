import { useState } from 'react'
import { AppProvider, useApp } from './store'
import { ToastProvider } from './components/Toast'
import { Icon, type IconName } from './components/Icons'
import Login from './pages/Login'
import Pos from './pages/Pos'
import Items from './pages/Items'
import Reports from './pages/Reports'
import Settings from './pages/Settings'

type TabId = 'pos' | 'items' | 'reports' | 'settings'

function Shell() {
  const { ready, needsSetup, session } = useApp()
  const [tab, setTab] = useState<TabId>('pos')

  if (!ready) {
    return (
      <div className="auth-wrap">
        <div className="auth-logo">
          <Icon name="scissors" size={52} />
          <div className="muted small">Memuat&hellip;</div>
        </div>
      </div>
    )
  }

  if (needsSetup || !session) {
    return <Login />
  }

  const allTabs: Array<{ id: TabId; label: string; icon: IconName; adminOnly?: boolean }> = [
    { id: 'pos', label: 'Kasir', icon: 'layout' },
    { id: 'items', label: 'Layanan', icon: 'scissors' },
    { id: 'reports', label: 'Laporan', icon: 'report' },
    { id: 'settings', label: 'Pengaturan', icon: 'settings', adminOnly: true },
  ]
  const tabs = allTabs.filter((t) => !t.adminOnly || session.role === 'admin')

  return (
    <div className="app">
      <main className="content">
        {tab === 'pos' && <Pos />}
        {tab === 'items' && <Items />}
        {tab === 'reports' && <Reports />}
        {tab === 'settings' && session.role === 'admin' && <Settings />}
      </main>
      <nav className="bottom-nav">
        {tabs.map((t) => (
          <button
            key={t.id}
            className={'nav-item' + (tab === t.id ? ' nav-item-active' : '')}
            onClick={() => setTab(t.id)}
          >
            <Icon name={t.icon} />
            <span>{t.label}</span>
          </button>
        ))}
      </nav>
    </div>
  )
}

export default function App() {
  return (
    <AppProvider>
      <ToastProvider>
        <Shell />
      </ToastProvider>
    </AppProvider>
  )
}