/* Human-written interface translations. Dates and form input remain owned by the app. */
(() => {
  'use strict';
  const supported = {
    ar: { name: 'العربية', dir: 'rtl', tag: 'ar-SA' },
    en: { name: 'English', dir: 'ltr', tag: 'en-GB' },
    ur: { name: 'اردو', dir: 'rtl', tag: 'ur-PK' },
    zh: { name: '简体中文', dir: 'ltr', tag: 'zh-CN' }
  };
  const dictionary = window.SITE_TRANSLATIONS || {};
  const storageKey = 'makkah-guide-language';
  let locale = 'ar';
  try { const saved = localStorage.getItem(storageKey); if (supported[saved]) locale = saved; } catch { /* Storage may be disabled. */ }
  const textSources = new WeakMap();
  const attributeSources = new WeakMap();
  const reverseExact = new Map();
  const templates = [];
  const translatedAttributes = ['aria-label', 'aria-description', 'title', 'alt', 'placeholder'];
  const regexEscape = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  for (const [source, translations] of Object.entries(dictionary)) {
    reverseExact.set(source, source);
    for (const translated of Object.values(translations)) if (typeof translated === 'string' && !reverseExact.has(translated)) reverseExact.set(translated, source);
    if (!/\{\w+\}/.test(source)) continue;
    for (const version of [source, ...Object.values(translations)]) {
      if (typeof version !== 'string') continue;
      const names = [];
      let last = 0, expression = '^';
      for (const match of version.matchAll(/\{(\w+)\}/g)) {
        expression += regexEscape(version.slice(last, match.index)) + '(.+?)';
        names.push(match[1]);
        last = match.index + match[0].length;
      }
      expression += regexEscape(version.slice(last)) + '$';
      templates.push({ source, names, pattern: new RegExp(expression, 'u') });
    }
  }
  const ignoreElement = element => element?.closest?.('[data-i18n-ignore], script, style, textarea, code, pre, svg');
  function number(value) { return new Intl.NumberFormat(supported[locale].tag).format(value); }
  function translatedValue(value) { return typeof value === 'number' ? number(value) : translate(String(value)); }
  function interpolate(template, params) { return template.replace(/\{(\w+)\}/g, (whole, key) => key in params ? translatedValue(params[key]) : whole); }
  function translate(value, params = null) {
    const exact = reverseExact.get(value);
    if (exact) return interpolate(locale === 'ar' ? exact : (dictionary[exact]?.[locale] || exact), params || {});
    if (params) return interpolate(dictionary[value]?.[locale] || value, params);
    for (const template of templates) {
      const match = value.match(template.pattern);
      if (!match) continue;
      const captured = Object.fromEntries(template.names.map((name, index) => [name, match[index + 1]]));
      const target = locale === 'ar' ? template.source : (dictionary[template.source]?.[locale] || template.source);
      return interpolate(target, captured);
    }
    return value;
  }
  function translateText(node) {
    if (!node.parentElement || ignoreElement(node.parentElement) || node.parentElement.closest('[data-i18n]')) return;
    const current = node.nodeValue;
    if (!current?.trim()) return;
    let entry = textSources.get(node);
    if (!entry || current !== entry.rendered) {
      const trimmed = current.trim();
      entry = { source: reverseExact.get(trimmed) || trimmed, before: current.match(/^\s*/)[0], after: current.match(/\s*$/)[0] };
    }
    const next = entry.before + translate(entry.source) + entry.after;
    entry.rendered = next;
    textSources.set(node, entry);
    if (current !== next) node.nodeValue = next;
  }
  function translateAttributes(element) {
    if (ignoreElement(element)) return;
    const names = [...translatedAttributes];
    if (element.tagName === 'META' && element.getAttribute('name') === 'description') names.push('content');
    let entries = attributeSources.get(element);
    if (!entries) { entries = new Map(); attributeSources.set(element, entries); }
    for (const name of names) {
      if (!element.hasAttribute(name)) continue;
      const current = element.getAttribute(name);
      let entry = entries.get(name);
      if (!entry || current !== entry.rendered) entry = { source: reverseExact.get(current) || current };
      const translated = translate(entry.source);
      entry.rendered = translated;
      entries.set(name, entry);
      if (current !== translated) element.setAttribute(name, translated);
    }
  }
  const headingBreaks = {
    ar: { 'خريطة مكة': 'خريطة\nمكة', 'مسار الحافلة': 'مسار\nالحافلة', 'مواقف الحافلات': 'مواقف\nالحافلات' },
    en: { 'خريطة مكة': 'Makkah\nMap', 'مسار الحافلة': 'Bus\nRoute', 'مواقف الحافلات': 'Bus\nStops' },
    ur: { 'خريطة مكة': 'مکہ کا\nنقشہ', 'مسار الحافلة': 'بس کا\nروٹ', 'مواقف الحافلات': 'بس\nاسٹاپ' },
    zh: { 'خريطة مكة': '麦加\n地图', 'مسار الحافلة': '巴士\n路线', 'مواقف الحافلات': '巴士\n站点' }
  };
  function walk(root) {
    if (root.nodeType === 3) { translateText(root); return; }
    if (root.nodeType !== 1 && root.nodeType !== 9) return;
    if (root.nodeType === 1) {
      if (ignoreElement(root)) return;
      translateAttributes(root);
      if (root.hasAttribute('data-i18n')) {
        const source = root.getAttribute('data-i18n');
        const text = root.hasAttribute('data-i18n-break') ? (headingBreaks[locale]?.[source] || translate(source)) : translate(source);
        if (root.textContent !== text) root.textContent = text;
        return;
      }
    }
    for (const child of [...root.childNodes]) walk(child);
  }
  let observer;
  const observerOptions = { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: [...translatedAttributes, 'content'] };
  function refresh(root = document.documentElement) {
    observer?.disconnect();
    walk(root);
    observer?.observe(document.documentElement, observerOptions);
  }
  function updateControls() {
    const label = document.querySelector('#language-label');
    if (label) label.textContent = supported[locale].name;
    document.querySelectorAll('[data-site-language]').forEach(button => {
      const selected = button.dataset.siteLanguage === locale;
      button.classList.toggle('selected', selected);
      button.setAttribute('aria-pressed', String(selected));
    });
  }
  function setLocale(next, persist = true) {
    if (!supported[next]) return;
    locale = next;
    document.documentElement.lang = next === 'zh' ? 'zh-Hans' : next;
    document.documentElement.dir = supported[next].dir;
    if (persist) try { localStorage.setItem(storageKey, next); } catch { /* Keep working without storage. */ }
    refresh();
    updateControls();
    document.dispatchEvent(new window.CustomEvent('localechange', { detail: { locale: next } }));
    refresh();
  }
  window.I18n = {
    t: translate,
    variants: source => [...new Set([source, ...Object.values(dictionary[source] || {})])],
    formatNumber: number,
    refresh,
    setLocale,
    get locale() { return locale; },
    get localeTag() { return supported[locale].tag; },
    get direction() { return supported[locale].dir; }
  };
  if (window.MutationObserver) observer = new window.MutationObserver(records => {
    observer.disconnect();
    const roots = new Set();
    for (const record of records) {
      if (record.type === 'childList') for (const node of record.addedNodes) roots.add(node);
      else roots.add(record.target);
    }
    for (const root of roots) if (root.isConnected) walk(root);
    observer.observe(document.documentElement, observerOptions);
  });
  setLocale(locale, false);
})();
