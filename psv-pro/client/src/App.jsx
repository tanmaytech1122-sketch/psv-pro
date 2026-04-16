import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import Sidebar          from './components/layout/Sidebar'
import Header           from './components/layout/Header'
import GasSizing        from './components/sizing/GasSizing'
import SteamSizing      from './components/sizing/SteamSizing'
import LiquidSizing     from './components/sizing/LiquidSizing'
import TwoPhaseSizing   from './components/sizing/TwoPhaseSizing'
import FireCase         from './components/fire/FireCase'
import BlowdownPage     from './components/blowdown/BlowdownPage'
import ThermalPage      from './components/sizing/ThermalPage'
import TubeRupturePage  from './components/sizing/TubeRupturePage'
import API2000Page      from './components/sizing/API2000Page'
import ScenarioMatrix   from './components/sizing/ScenarioMatrix'
import ProjectsPage     from './components/projects/ProjectsPage'
import RegisterPage     from './components/projects/RegisterPage'
import SettingsPage     from './components/layout/SettingsPage'
import PlaceholderPage  from './components/layout/PlaceholderPage'
import AIQuery          from './components/ai/AIQuery'  // NEW

const qc = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30000 } }
})

function Layout({ children }) {
  return (
    <div className="flex h-screen overflow-hidden bg-surface-0">
      <Sidebar/>
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Header/>
        <main className="flex-1 overflow-hidden p-4">
          {children}
        </main>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={qc}>
      <BrowserRouter>
        <Routes>
          <Route path="/"                 element={<Navigate to="/size/gas" replace/>}/>
          <Route path="/size/gas"         element={<Layout><GasSizing/></Layout>}/>
          <Route path="/size/steam"       element={<Layout><SteamSizing/></Layout>}/>
          <Route path="/size/liquid"      element={<Layout><LiquidSizing/></Layout>}/>
          <Route path="/size/twophase"    element={<Layout><TwoPhaseSizing/></Layout>}/>
          <Route path="/size/fire"        element={<Layout><FireCase/></Layout>}/>
          <Route path="/size/blowdown"    element={<Layout><BlowdownPage/></Layout>}/>
          <Route path="/size/thermal"     element={<Layout><ThermalPage/></Layout>}/>
          <Route path="/size/tuberupture" element={<Layout><TubeRupturePage/></Layout>}/>
          <Route path="/size/api2000"     element={<Layout><API2000Page/></Layout>}/>
          <Route path="/scenarios"        element={<Layout><ScenarioMatrix/></Layout>}/>
          <Route path="/reaction"         element={<Layout><PlaceholderPage title="Reaction Force"/></Layout>}/>
          <Route path="/piping"           element={<Layout><PlaceholderPage title="Inlet Piping ΔP"/></Layout>}/>
          <Route path="/sil"              element={<Layout><PlaceholderPage title="SIL / LOPA"/></Layout>}/>
          <Route path="/projects"         element={<Layout><ProjectsPage/></Layout>}/>
          <Route path="/register"         element={<Layout><RegisterPage/></Layout>}/>
          <Route path="/settings"         element={<Layout><SettingsPage/></Layout>}/>
          <Route path="/ai"               element={<Layout><AIQuery/></Layout>}/>  {/* NEW */}
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}