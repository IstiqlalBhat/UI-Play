import { LiquidMetal } from '@paper-design/shaders-react';
import GlossOverlay from './GlossOverlay';
import './ShaderBorder.css';

export default function ShaderBorder({
  theme,
  padding = 5,
  radius = 50,
  height,
  width,
  speed = 1,
  scale = 3,
  children,
  className = '',
  style = {},
}) {
  const innerRadius = radius - padding;
  const ringInset = Math.max(2, padding - 2);
  const ringRadius = radius - ringInset;

  return (
    <div
      className={`sb-outer ${className}`}
      style={{
        height,
        width,
        borderRadius: radius,
        padding,
        ...style,
      }}
    >
      {/* Layer 1: Shader background (visible as the border) */}
      <span className="sb-shader" style={{ borderRadius: radius }}>
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
          speed={speed}
          scale={scale}
          fit="cover"
        />
      </span>

      {/* Layer 2: Dark ring separator */}
      <span
        className="sb-ring"
        style={{ inset: ringInset, borderRadius: ringRadius }}
      />

      {/* Layer 3: White inner face */}
      <div className="sb-face" style={{ borderRadius: innerRadius }}>
        <GlossOverlay height="50%" intensity={0.8} fadeEnd={0.1} radius={innerRadius} />
        {children}
      </div>
    </div>
  );
}
