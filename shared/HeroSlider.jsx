// Slider de fondo para secciones "hero" (Tienda y Directorio).
// Las imágenes se desvanecen una sobre otra; el contenido (children) queda encima.
import { useCallback, useEffect, useRef, useState } from 'react';
import './HeroSlider.css';

/**
 * slides: [{ key, src, caption?, href? }]
 * interval: milisegundos entre imágenes
 * className: clases de la sección contenedora (ej. "hero")
 * overlay: degradado oscuro sobre la imagen para que el texto se lea bien
 */
export default function HeroSlider({ slides = [], interval = 6000, className = '', style, overlay = true, children, id }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchX = useRef(null);
  const count = slides.length;

  const go = useCallback((i) => setIndex(((i % count) + count) % count), [count]);

  useEffect(() => { if (index >= count) setIndex(0); }, [count, index]);

  useEffect(() => {
    if (count < 2 || paused) return;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return;
    const t = setTimeout(() => go(index + 1), interval);
    return () => clearTimeout(t);
  }, [index, count, paused, interval, go]);

  const current = slides[index];

  return (
    <section
      id={id}
      className={`hs ${count ? 'hs-has-slides' : ''} ${className}`}
      style={style}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={(e) => { touchX.current = e.touches[0].clientX; }}
      onTouchEnd={(e) => {
        if (touchX.current == null) return;
        const dx = e.changedTouches[0].clientX - touchX.current;
        if (Math.abs(dx) > 50) go(index + (dx < 0 ? 1 : -1));
        touchX.current = null;
      }}
    >
      {count > 0 && (
        <div className="hs-track" aria-hidden="true">
          {slides.map((s, i) => (
            <div key={s.key ?? i} className={`hs-slide ${i === index ? 'active' : ''}`} style={{ backgroundImage: `url("${s.src}")` }} />
          ))}
          {overlay && <div className="hs-overlay" />}
        </div>
      )}

      <div className="hs-content">{children}</div>

      {current?.caption && (
        current.href
          ? <a className="hs-caption" href={current.href}>{current.caption}</a>
          : <span className="hs-caption">{current.caption}</span>
      )}

      {count > 1 && (
        <>
          <button type="button" className="hs-arrow prev" onClick={() => go(index - 1)} aria-label="Imagen anterior">‹</button>
          <button type="button" className="hs-arrow next" onClick={() => go(index + 1)} aria-label="Imagen siguiente">›</button>
          <div className="hs-dots" role="tablist">
            {slides.map((s, i) => (
              <button
                key={s.key ?? i}
                type="button"
                className={i === index ? 'active' : ''}
                onClick={() => go(i)}
                aria-label={`Ir a la imagen ${i + 1}`}
                aria-selected={i === index}
                role="tab"
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
}
