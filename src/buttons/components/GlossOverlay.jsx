import './GlossOverlay.css';

export default function GlossOverlay({
  height = '50%',
  intensity = 0.8,
  fadeEnd = 0.1,
  radius,
  className = '',
  style = {},
}) {
  return (
    <span
      className={`gloss-overlay ${className}`}
      style={{
        height,
        borderRadius: radius ? `${radius}px ${radius}px 0 0` : undefined,
        background: `linear-gradient(180deg, rgba(255,255,255,${intensity}) 0%, rgba(255,255,255,${fadeEnd}) 100%)`,
        ...style,
      }}
    />
  );
}
