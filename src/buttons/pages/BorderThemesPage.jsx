import { useState } from 'react';
import { LiquidMetal } from '@paper-design/shaders-react';
import { themes } from '../data/themes';
import ShaderBorder from '../components/ShaderBorder';
import './BorderThemesPage.css';

export default function BorderThemesPage() {
  const [active, setActive] = useState(3);
  const t = themes[active];

  return (
    <div className="bt-page">
      {/* Button pill with shader border — centered */}
      <div className="bt-hero">
        <ShaderBorder
          key={active}
          theme={t}
          radius={50}
          padding={5}
          height={100}
          speed={1}
          scale={3}
          className="bt-pill"
        >
          <span className="req-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="5" y="5" width="14" height="14" rx="3" />
            </svg>
          </span>
          <span className="req-text">Request access</span>
        </ShaderBorder>
      </div>

      {/* Border Themes selector */}
      <div className="bt-section">
        <p className="bt-title">BORDER THEMES</p>
        <div className="bt-swatches">
          {themes.map((theme, i) => (
            <div
              key={theme.name}
              className={`bt-swatch ${i === active ? 'bt-swatch--active' : ''}`}
              onClick={() => setActive(i)}
            >
              <div className="bt-swatch__card" style={{ background: theme.swatchBg }}>
                <LiquidMetal
                  style={{ width: '100%', height: '100%', display: 'block' }}
                  colorBack={theme.colorBack}
                  colorTint={theme.colorTint}
                  shape="metaballs"
                  repetition={theme.repetition}
                  softness={theme.softness}
                  shiftRed={theme.shiftRed}
                  shiftBlue={theme.shiftBlue}
                  distortion={theme.distortion}
                  contour={theme.contour}
                  angle={theme.angle}
                  speed={0.8}
                  scale={2.5}
                  fit="cover"
                />
              </div>
              <span className={`bt-swatch__label ${i === active ? 'bt-swatch__label--active' : ''}`}>
                {theme.name}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
