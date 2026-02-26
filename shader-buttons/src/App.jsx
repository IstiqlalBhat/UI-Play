import { useState } from 'react';
import BorderThemesPage from './pages/BorderThemesPage';
import GlassButtonPage from './pages/GlassButtonPage';
import './App.css';

export default function App() {
  const [page, setPage] = useState('themes');
  return (
    <>
      <div className="pnav">
        <button className={`pnav__b ${page === 'themes' ? 'pnav__b--on' : ''}`} onClick={() => setPage('themes')}>Border Themes</button>
        <button className={`pnav__b ${page === 'glass' ? 'pnav__b--on' : ''}`} onClick={() => setPage('glass')}>Glass Button</button>
      </div>
      {page === 'themes' && <BorderThemesPage />}
      {page === 'glass' && <GlassButtonPage />}
    </>
  );
}
