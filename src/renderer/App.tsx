import React, { useState } from 'react'
import MainOverlay from './components/MainOverlay'
import SettingsView from './components/SettingsView'
import SessionList from './components/SessionList'

export default function App() {
  const [view, setView] = useState<'main' | 'settings' | 'sessions'>('main')
  const hash = window.location.hash.slice(1)
  
  React.useEffect(() => {
    if (hash === '/settings') {
      setView('settings')
    } else if (hash === '/sessions') {
      setView('sessions')
    }
  }, [hash])

  const handleNavigate = (newView: 'main' | 'settings' | 'sessions') => {
    setView(newView)
    window.location.hash = newView === 'main' ? '' : `/${newView}`
  }

  return (
    <div className="h-full w-full bg-slate-900">
      {view === 'main' && <MainOverlay onNavigate={handleNavigate} />}
      {view === 'settings' && <SettingsView onBack={() => handleNavigate('main')} />}
      {view === 'sessions' && <SessionList onBack={() => handleNavigate('main')} />}
    </div>
  )
}
