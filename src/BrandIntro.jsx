import React, { useEffect, useRef, useState } from 'react';

/** Video de entrada local. El diálogo vuelve inerte el formulario mientras se reproduce. */
export function BrandIntro({ onComplete }) {
  const dialog = useRef(null);
  const video = useRef(null);
  const timeout = useRef(null);
  const done = useRef(false);
  const callback = useRef(onComplete);
  callback.current = onComplete;
  const [portrait] = useState(() => window.matchMedia('(max-aspect-ratio: 3/4)').matches);
  const finish = () => {
    if (done.current) return;
    done.current = true;
    window.clearTimeout(timeout.current);
    video.current?.pause();
    callback.current();
  };
  const playWithSound = () => {
    if (done.current || !video.current) return;
    video.current.muted = false;
    window.clearTimeout(timeout.current);
    timeout.current = window.setTimeout(finish, 10000);
    video.current.play().catch(error => {
      if (done.current) return;
      if (error.name === 'NotAllowedError') {
        video.current.muted = true;
        video.current.play().catch(finish);
      } else {
        finish();
      }
    });
  };

  useEffect(() => {
    done.current = false;
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (media.matches) { finish(); return; }
    const modal = dialog.current;
    if (!modal?.showModal) { finish(); return; }
    modal.showModal();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const motionChange = () => { if (media.matches) finish(); };
    const enableSound = () => {
      const player = video.current;
      if (done.current || !player?.muted) return;
      player.muted = false;
      player.play().catch(() => {
        if (done.current) return;
        player.muted = true;
        player.play().catch(finish);
      });
    };
    media.addEventListener('change', motionChange);
    window.addEventListener('click', enableSound);
    window.addEventListener('keydown', enableSound);
    playWithSound();
    return () => {
      done.current = true;
      window.clearTimeout(timeout.current);
      media.removeEventListener('change', motionChange);
      window.removeEventListener('click', enableSound);
      window.removeEventListener('keydown', enableSound);
      document.body.style.overflow = previousOverflow;
      modal.close();
    };
  }, []);

  return <dialog className="brand-intro" ref={dialog} aria-label="Bienvenido a ARCA, Misión Cristiana El Calvario" onCancel={event => { event.preventDefault(); finish(); }}>
    <video ref={video} playsInline preload="auto" aria-hidden="true"
      src={portrait ? '/media/arca-intro-vertical.mp4' : '/media/arca-intro.mp4'}
      onEnded={finish} onError={finish} />
    <div className="intro-controls"><span>EL CALVARIO <b>·</b> ARCA</span><button type="button" onClick={finish} autoFocus>Saltar intro <span aria-hidden="true">→</span></button></div>
  </dialog>;
}
