/* A visible-first enhancement. Nothing is hidden while waiting for JavaScript. */
(() => {
  'use strict';
  const root = document.documentElement;
  const media = typeof window.matchMedia === 'function' ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  const revealed = new WeakSet();
  const pending = new Set();
  let observer = null;
  const pageSelector = '.intro, .quick-links>.service-card, .schedule-section, .assistant-section, .location-section, .assurance-strip, .footer-brand';
  const dialogSelector = '.makkah-hero, .destination-section, .popup-location-panel, .popup-landmarks, .route-summary, .route-stations, .stop-item';
  function clearAnimation(element) {
    element.classList.remove('motion-enter');
    element.style.removeProperty('--motion-delay');
    pending.delete(element);
  }
  function enter(element, delay = 0) {
    if (!element.isConnected || revealed.has(element) || root.dataset.motion !== 'on') return;
    revealed.add(element);
    element.style.setProperty('--motion-delay', `${Math.max(0, Math.min(160, delay))}ms`);
    element.classList.add('motion-enter');
    pending.add(element);
    const finish = event => {
      if (event.target !== element) return;
      element.removeEventListener('animationend', finish);
      clearAnimation(element);
    };
    element.addEventListener('animationend', finish);
  }
  function watch(elements) {
    if (!observer || root.dataset.motion !== 'on') return;
    elements.forEach((element, index) => {
      if (revealed.has(element)) return;
      element.dataset.motionOrder = String(index % 4);
      observer.observe(element);
    });
  }
  function scanDialog() {
    const body = document.getElementById('dialog-body');
    if (body) watch([...body.querySelectorAll(dialogSelector)]);
  }
  function configureMotion() {
    const enabled = Boolean(media && !media.matches);
    root.dataset.motion = enabled ? 'on' : 'off';
    if (observer) observer.disconnect();
    observer = null;
    if (!enabled) {
      for (const element of pending) clearAnimation(element);
      return;
    }
    if (!('IntersectionObserver' in window)) return;
    observer = new window.IntersectionObserver(entries => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        observer?.unobserve(entry.target);
        const delay = Number(entry.target.dataset.motionOrder || 0) * 45;
        enter(entry.target, delay);
      }
    }, { threshold: .08, rootMargin: '0px 0px -12px 0px' });
    watch([...document.querySelectorAll(pageSelector)]);
    scanDialog();
  }
  configureMotion();
  if (media?.addEventListener) media.addEventListener('change', configureMotion);
  else if (media?.addListener) media.addListener(configureMotion);
  const dialogBody = document.getElementById('dialog-body');
  // Observe replacement of the dialog's top-level content, not map tile/marker mutations.
  if (dialogBody && 'MutationObserver' in window) {
    new window.MutationObserver(scanDialog).observe(dialogBody, { childList: true });
  }
  const dialog = document.getElementById('info-dialog');
  if (dialog && 'MutationObserver' in window) {
    new window.MutationObserver(() => { if (dialog.open) scanDialog(); }).observe(dialog, { attributes: true, attributeFilter: ['open'] });
    dialog.addEventListener('close', () => {
      for (const element of [...pending]) if (!element.isConnected || dialog.contains(element)) clearAnimation(element);
    });
  }
  document.addEventListener('focusin', event => {
    const element = event.target.closest?.('.motion-enter');
    if (element) clearAnimation(element);
  });
})();
