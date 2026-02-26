import { LiquidMetal } from '@paper-design/shaders-react';
import { GLASS_BUTTON_THEME } from '../data/themes';
import ShaderBorder from '../components/ShaderBorder';
import GlossOverlay from '../components/GlossOverlay';
import './GlassButtonPage.css';

export default function GlassButtonPage() {
  return (
    <div className="gp-page">
      {/* Subtle liquid metal paper texture background */}
      <div className="gp-bg">
        <LiquidMetal
          style={{ width: '100%', height: '100%', display: 'block' }}
          colorBack="#bdbdbe"
          colorTint="#d8d8da"
          shape="metaballs"
          repetition={2}
          softness={0.35}
          shiftRed={0.01}
          shiftBlue={0.01}
          distortion={0.02}
          contour={0.25}
          angle={70}
          speed={0.15}
          scale={2.5}
          fit="cover"
        />
      </div>

      {/* Three-layer glass button */}
      <div className="gp-center">
        {/* Layer 1: Wide frosted glass strip */}
        <div className="gp-strip">
          <GlossOverlay
            height="48%"
            intensity={0.3}
            fadeEnd={0}
            className="gp-strip__highlight"
          />

          {/* Layer 2+3: ShaderBorder capsule */}
          <ShaderBorder
            theme={GLASS_BUTTON_THEME}
            radius={42}
            padding={3}
            speed={0.8}
            scale={3}
            className="gp-capsule"
          >
            <span className="gp-face__text">Only paper</span>
          </ShaderBorder>
        </div>
      </div>
    </div>
  );
}
