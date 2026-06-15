import { NavLink, Route, Routes } from 'react-router-dom'
import Home from './pages/Home'
import Calculator from './pages/Calculator'
import GridDesigner from './pages/GridDesigner'
import ImageToPattern from './pages/ImageToPattern'

const navItems = [
  { to: '/', label: 'Home', end: true },
  { to: '/calculator', label: 'Size Calculator' },
  { to: '/designer', label: 'Grid Designer' },
  { to: '/image', label: 'Image → Pattern' },
]

export default function App() {
  return (
    <div className="min-h-full bg-slate-50 text-slate-800">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <NavLink to="/" className="flex items-center gap-2 text-lg font-bold text-rose-600">
            <span aria-hidden>🧶</span>
            <span>Crochet Studio</span>
          </NavLink>
          <nav className="flex flex-wrap gap-1">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `rounded-md px-3 py-1.5 text-sm font-medium transition ${
                    isActive
                      ? 'bg-rose-100 text-rose-700'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/calculator" element={<Calculator />} />
          <Route path="/designer" element={<GridDesigner />} />
          <Route path="/image" element={<ImageToPattern />} />
        </Routes>
      </main>

      <footer className="mx-auto max-w-6xl px-4 py-8 text-center text-xs text-slate-400">
        Crochet Studio · designs are saved in your browser
      </footer>
    </div>
  )
}
