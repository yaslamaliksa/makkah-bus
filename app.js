'use strict';
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const appText = (source, params = {}) => window.I18n?.t(source, params) ?? source.replace(/\{(\w+)\}/g, (_, key) => String(params[key] ?? `{${key}}`));
const appNumber = value => window.I18n?.formatNumber(value) ?? Number(value).toLocaleString('ar-SA');
const icon = (name, extra = '') => `<svg class="icon ${extra}" aria-hidden="true"><use href="#i-${name}"/></svg>`;
const routes = [
  { id: 'A1', time: '11:00', period: 'صباحًا', stop: 'A', origin: 'مواقف كدي', via: 'منطقة أجياد', end: 'محيط المسجد الحرام', lat: 21.3899, lon: 39.8254 },
  { id: 'A3', time: '10:00', period: 'صباحًا', stop: 'A', origin: 'العزيزية', via: 'منطقة محبس الجن', end: 'محيط المسجد الحرام', lat: 21.4109, lon: 39.8668 },
  { id: 'A7', time: '4:45', period: 'مساءً', stop: 'A', origin: 'الزاهر', via: 'منطقة جرول', end: 'محيط المسجد الحرام', lat: 21.4457, lon: 39.8035 }
];
const languages = {
  en: { name: 'English', arabic: 'الإنجليزية', locale: 'en-US' },
  ur: { name: 'اردو', arabic: 'الأردية', locale: 'ur-PK' },
  id: { name: 'Indonesia', arabic: 'الإندونيسية', locale: 'id-ID' },
  tr: { name: 'Türkçe', arabic: 'التركية', locale: 'tr-TR' },
  zh: { name: '简体中文', arabic: 'الصينية المبسطة', locale: 'zh-CN' }
};
const phrases = [
  { ar: 'أين موقف الحافلات؟', en: 'Where is the bus stop?', ur: 'بس اسٹاپ کہاں ہے؟', id: 'Di mana halte bus?', tr: 'Otobüs durağı nerede?', zh: '巴士站在哪里？' },
  { ar: 'أريد الذهاب إلى الحرم', en: 'I would like to go to the Grand Mosque.', ur: 'میں حرم جانا چاہتا ہوں۔', id: 'Saya ingin pergi ke Masjidil Haram.', tr: 'Mescid-i Haram’a gitmek istiyorum.', zh: '我想去禁寺。' },
  { ar: 'متى تغادر الحافلة؟', en: 'When does the bus leave?', ur: 'بس کب روانہ ہوگی؟', id: 'Kapan bus berangkat?', tr: 'Otobüs ne zaman kalkıyor?', zh: '巴士什么时候出发？' },
  { ar: 'شكرًا جزيلًا', en: 'Thank you very much.', ur: 'بہت شکریہ۔', id: 'Terima kasih banyak.', tr: 'Çok teşekkür ederim.', zh: '非常感谢。' }
];
let targetLanguage = 'en';
let selectedPhrase = null;
let toastTimer;
function notify(message) {
  clearTimeout(toastTimer);
  $('#toast').textContent = appText(message);
  $('#toast').hidden = false;
  toastTimer = setTimeout(() => { $('#toast').hidden = true; }, 4200);
}
function renderSchedule() {
  const filter = $('#bus-filter').value;
  const selected = routes.filter(route => filter === 'all' || route.id === filter);
  $('#schedule-rows').innerHTML = selected.map(route => `<tr><td><span class="bus-label">${icon('bus')}<bdi>${route.id}</bdi></span></td><td><span class="time">${route.time}<small dir="${document.documentElement.dir || 'rtl'}">${appText(route.period)}</small></span></td><td><span class="stop-tag">${route.stop}</span></td><td><button class="row-button" data-route="${route.id}" aria-label="${appText('تفاصيل الحافلة {id}', { id: route.id })}">${icon('arrow')}</button></td></tr>`).join('');
}
$('#bus-filter').addEventListener('change', renderSchedule);
$('#schedule-rows').addEventListener('click', event => {
  const button = event.target.closest('[data-route]');
  if (button) openRoutes(button.dataset.route);
});
renderSchedule();
const timeZone = 'Asia/Riyadh';
function renderDates() {
  const now = new Date();
  const locale = window.I18n?.localeTag || 'ar-SA';
  $('#short-date').textContent = new Intl.DateTimeFormat(locale, { timeZone, day: 'numeric', month: 'long', calendar: 'gregory' }).format(now);
  const weekday = new Intl.DateTimeFormat(locale, { timeZone, weekday: 'long' }).format(now);
  const hijri = new Intl.DateTimeFormat(locale, { timeZone, calendar: 'islamic-umalqura', day: 'numeric', month: 'long', year: 'numeric' }).format(now);
  const gregorian = new Intl.DateTimeFormat(locale, { timeZone, calendar: 'gregory', day: '2-digit', month: '2-digit', year: 'numeric' }).format(now);
  $('#full-date').textContent = `${weekday} · ${hijri}  |  ${gregorian}`;
  $('#copyright-year').textContent = new Intl.DateTimeFormat('en', { timeZone, year: 'numeric' }).format(now);
  ['#short-date', '#full-date', '#copyright-year'].forEach(selector => $(selector).setAttribute('data-i18n-ignore', 'true'));
}
renderDates();

const dialog = $('#info-dialog');
let lastFocus = null;
function openDialog(title, kicker, content) {
  dialog.classList.remove('makkah-dialog');
  lastFocus = document.activeElement;
  $('#dialog-title').textContent = title;
  $('#dialog-kicker').textContent = kicker;
  $('#dialog-body').innerHTML = content;
  if (!dialog.open) dialog.showModal();
  document.body.style.overflow = 'hidden';
}
function closeDialog() { dialog.close(); }
$('#close-dialog').addEventListener('click', closeDialog);
dialog.addEventListener('close', () => { document.body.style.overflow = ''; if (lastFocus?.isConnected) lastFocus.focus(); });
dialog.addEventListener('click', event => { if (event.target === dialog) { const rect = dialog.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) closeDialog(); } });
function mapUrl(lat = 21.4225, lon = 39.8262, zoom = .013) {
  const bottom = Math.max(-85, lat - zoom), top = Math.min(85, lat + zoom);
  const left = Math.max(-180, lon - zoom * 1.6), right = Math.min(180, lon + zoom * 1.6);
  return `https://www.openstreetmap.org/export/embed.html?bbox=${left}%2C${bottom}%2C${right}%2C${top}&layer=mapnik&marker=${lat}%2C${lon}`;
}
function externalMap(lat, lon) { return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=16/${lat}/${lon}`; }
function routeContent(id) {
  const route = routes.find(item => item.id === id) || routes[0];
  return `<div class="dialog-route-picker" aria-label="اختيار الحافلة">${routes.map(item => `<button data-select-route="${item.id}" class="${item.id === route.id ? 'selected' : ''}" aria-pressed="${item.id === route.id}">${item.id}</button>`).join('')}</div><div class="route-summary"><div><span>الحافلة</span><strong>${route.id}</strong></div><div><span>وقت المغادرة</span><strong><bdi>${route.time}</bdi> ${route.period}</strong></div><div><span>الموقف</span><strong>${route.stop}</strong></div></div><ol class="route-stations"><li>${route.origin}<small>نقطة انطلاق توضيحية</small></li><li>${route.via}<small>نقطة مرور توضيحية</small></li><li>${route.end}<small>الوجهة</small></li></ol><p class="dialog-note">هذا مثال لعرض تفاصيل المسار، وليس مسارًا تشغيليًا معتمدًا. تأكّد من المسار والموقف والموعد لدى مشغّل الحافلة قبل السفر.</p><a class="map-external" href="${externalMap(route.lat, route.lon)}" target="_blank" rel="noopener noreferrer">استكشف منطقة الانطلاق على الخريطة ${icon('external','tiny')}</a>`;
}
function openRoutes(id = 'A1') { openDialog('مسار الحافلة', 'تفاصيل رحلتك · نموذج توضيحي', routeContent(id)); }
function openStops() {
  openDialog('مواقف الحافلات', 'نقاط مرجعية على الخريطة', `<p class="dialog-note">استكشف مناطق الانطلاق التالية على الخريطة. هذه نقاط مرجعية للاستكشاف، ويُرجى الرجوع إلى المشغّل لمعرفة الموقف التشغيلي الدقيق.</p>${routes.map(route => `<div class="stop-item"><div><strong>${route.origin}</strong><small>عرض المنطقة على خريطة مكة</small></div><a href="${externalMap(route.lat, route.lon)}" target="_blank" rel="noopener noreferrer" aria-label="فتح خريطة ${route.origin}">${icon('pin')}</a></div>`).join('')}`);
}
$$('[data-dialog]').forEach(button => button.addEventListener('click', () => {
  ({ routes: openRoutes, stops: openStops })[button.dataset.dialog]();
}));
$('#dialog-body').addEventListener('click', event => {
  const routeButton = event.target.closest('[data-select-route]');
  if (routeButton) { $('#dialog-body').innerHTML = routeContent(routeButton.dataset.selectRoute); $(`[data-select-route="${routeButton.dataset.selectRoute}"]`).focus(); }
  const languageButton = event.target.closest('[data-dialog-language]');
  if (languageButton) { chooseLanguage(languageButton.dataset.dialogLanguage); closeDialog(); }
});

const languageMenu = $('#language-menu');
function setLanguageMenu(open) { languageMenu.hidden = !open; $('#language-button').setAttribute('aria-expanded', String(open)); }
$('#language-button').addEventListener('click', () => setLanguageMenu(languageMenu.hidden));
$('#language-button').addEventListener('keydown', event => { if (event.key === 'ArrowDown') { event.preventDefault(); setLanguageMenu(true); languageMenu.querySelector('button').focus(); } });
document.addEventListener('click', event => { if (!event.target.closest('.language-wrap')) setLanguageMenu(false); });
document.addEventListener('keydown', event => { if (event.key === 'Escape' && !languageMenu.hidden) { setLanguageMenu(false); $('#language-button').focus(); } });
const siteLanguageNames = { ar: 'العربية', en: 'English', ur: 'اردو', zh: '简体中文' };
function refreshSiteLanguageControls() {
  const locale = window.I18n?.locale || 'ar';
  $('#language-label').setAttribute('data-i18n-ignore', 'true');
  $('#language-label').textContent = siteLanguageNames[locale] || siteLanguageNames.ar;
  $$('[data-site-language]').forEach(button => {
    const selected = button.dataset.siteLanguage === locale;
    button.classList.toggle('selected', selected);
    button.setAttribute('aria-pressed', String(selected));
  });
}
function chooseLanguage(code, silent = false) {
  if (!languages[code]) return;
  if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  targetLanguage = code;
  $('#target-language').setAttribute('data-i18n-ignore', 'true');
  $('#target-language').textContent = languages[code].name;
  if (selectedPhrase !== null) showPhrase(selectedPhrase);
  if (!silent) notify(appText('تم اختيار {name} للترجمة الصوتية', { name: appText(languages[code].arabic) }));
}
$$('[data-site-language]').forEach(button => button.addEventListener('click', () => {
  const locale = button.dataset.siteLanguage;
  window.I18n?.setLocale(locale);
  refreshSiteLanguageControls();
  setLanguageMenu(false);
  notify(appText('تم تغيير لغة الموقع إلى {name}', { name: siteLanguageNames[locale] }));
}));
refreshSiteLanguageControls();
$('#change-language').addEventListener('click', () => openDialog('اختر لغة المساعدة', 'ترجمة العبارات الإرشادية', `<div class="language-options">${Object.entries(languages).map(([code, language]) => `<div class="stop-item"><div><strong data-i18n-ignore lang="${language.locale}" dir="auto">${language.name}</strong><small>${language.arabic}</small></div><button class="primary-button" data-dialog-language="${code}">${targetLanguage === code ? 'محددة حاليًا' : 'اختيار'}</button></div>`).join('')}</div>`));

const barHeights = [8,14,22,31,18,11,6,12,26,34,20,15,8,17,30,36,20,11,9,24,37,28,13,7,19,30,39,23,16,8,12,23,33,20,11,7,16,27,19,10];
$('#waveform').innerHTML = barHeights.map((height, index) => `<i style="height:${height}px;animation-delay:${index * -63}ms"></i>`).join('');
function showPhrase(index, recognizedText) {
  const phrase = phrases[index];
  if (!phrase) return;
  selectedPhrase = index;
  $('#transcript').setAttribute('data-i18n-ignore', 'true');
  $('#transcript').lang = 'ar';
  $('#transcript').dir = 'rtl';
  $('#transcript').textContent = recognizedText || phrase.ar;
  $('#transcript').classList.add('has-text');
  $('#translation-result').hidden = false;
  $('#translation-text').setAttribute('data-i18n-ignore', 'true');
  $('#translation-text').textContent = phrase[targetLanguage];
  $('#translation-text').lang = targetLanguage === 'zh' ? 'zh-Hans' : targetLanguage;
  $('#translation-text').dir = targetLanguage === 'ur' ? 'rtl' : 'ltr';
  $('#record-status').textContent = 'الترجمة جاهزة — اضغط على السماعة للاستماع';
}
$$('[data-phrase]').forEach(button => button.addEventListener('click', () => showPhrase(Number(button.dataset.phrase))));
$('#speak-button').addEventListener('click', () => {
  if (!('speechSynthesis' in window)) { notify('القراءة الصوتية غير مدعومة في هذا المتصفح. يمكنك قراءة الترجمة المكتوبة.'); return; }
  if (selectedPhrase === null) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(phrases[selectedPhrase][targetLanguage]);
  utterance.lang = languages[targetLanguage].locale;
  utterance.rate = .9;
  utterance.onerror = () => notify('تعذّر تشغيل الصوت. قد لا يتوفر صوت لهذه اللغة على جهازك.');
  window.speechSynthesis.speak(utterance);
});
const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition;
let isRecording = false;
let hasRecognitionOutcome = false;
function recordingState(active) {
  isRecording = active;
  $('#record-button').classList.toggle('recording', active);
  $('#record-button').setAttribute('aria-pressed', String(active));
  $('#record-button').setAttribute('aria-label', active ? 'إيقاف التسجيل' : 'ابدأ التحدث بالعربية');
  $('#waveform').classList.toggle('listening', active);
}
function normalizeArabic(text) { return text.replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي').replace(/[؟?،,.!ًٌٍَُِّْ]/g, '').trim(); }
function recognizePhrase(text) {
  hasRecognitionOutcome = true;
  const normalized = normalizeArabic(text);
  let index = phrases.findIndex(phrase => normalizeArabic(phrase.ar) === normalized);
  if (index < 0) {
    if (/موقف|مواقف/.test(normalized)) index = 0;
    else if (/حرم|الحرام/.test(normalized)) index = 1;
    else if (/متي|تغادر|موعد|وقت|تطلع/.test(normalized)) index = 2;
    else if (/شكر/.test(normalized)) index = 3;
  }
  if (index >= 0) { showPhrase(index, text); return; }
  selectedPhrase = null;
  $('#transcript').setAttribute('data-i18n-ignore', 'true');
  $('#transcript').lang = 'ar';
  $('#transcript').dir = 'rtl';
  $('#transcript').textContent = text;
  $('#transcript').classList.add('has-text');
  $('#translation-result').hidden = true;
  $('#record-status').textContent = 'تم تدوين كلامك. اختر عبارة جاهزة لترجمتها إلى اللغة المحددة.';
}
$('#record-button').addEventListener('click', () => {
  if (!Recognition) { $('#record-status').textContent = 'التعرّف على الصوت غير متاح هنا. اختر عبارة سريعة بالأسفل.'; notify('يمكنك استخدام العبارات الجاهزة والترجمة المكتوبة.'); return; }
  if (isRecording) { recognition.stop(); return; }
  if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  recognition = new Recognition();
  hasRecognitionOutcome = false;
  recognition.lang = 'ar-SA';
  recognition.interimResults = false;
  recognition.continuous = false;
  recognition.onstart = () => { recordingState(true); $('#record-status').textContent = 'أستمع إليك… تحدّث بالعربية'; };
  recognition.onresult = event => recognizePhrase(event.results[0][0].transcript);
  recognition.onerror = event => {
    hasRecognitionOutcome = true;
    const errors = { 'not-allowed': 'لم يُمنح إذن الميكروفون. يمكنك اختيار عبارة جاهزة.', 'no-speech': 'لم أسمع كلامًا. اضغط وحاول مرة أخرى.', 'audio-capture': 'لم يُعثر على ميكروفون. استخدم العبارات الجاهزة.', network: 'تعذّر الاتصال بخدمة التعرّف على الصوت. استخدم العبارات الجاهزة.', aborted: 'توقف التسجيل.' };
    $('#record-status').textContent = errors[event.error] || 'تعذّر التعرّف على الصوت. حاول مرة أخرى أو اختر عبارة جاهزة.';
    recordingState(false);
  };
  recognition.onend = () => { recordingState(false); if (!hasRecognitionOutcome) $('#record-status').textContent = 'انتهى الاستماع. حاول مرة أخرى أو اختر عبارة جاهزة.'; };
  try { recognition.start(); } catch { recordingState(false); $('#record-status').textContent = 'تعذّر بدء التسجيل. اختر عبارة سريعة بالأسفل.'; }
});

let homepageLocationState = 'idle';
let homepageLocationAccuracy = null;
let homepageLocationError = null;
const homepageLocationErrors = {
  1: 'لم يُمنح إذن الموقع. يمكنك السماح به من إعدادات المتصفح أو استكشاف خريطة مكة.',
  2: 'الموقع غير متاح الآن. تحقق من تفعيل خدمات الموقع وحاول مجددًا.',
  3: 'انتهت مهلة تحديد الموقع. حاول مجددًا في مكان تتوفر فيه إشارة أفضل.'
};
function renderHomepageLocationStatus() {
  const buttonLabel = $('#locate-button span');
  const status = $('#location-status');
  if (homepageLocationState === 'requesting') {
    buttonLabel.textContent = appText('جارٍ تحديد الموقع…');
    status.textContent = appText('بانتظار إذنك للوصول إلى الموقع…');
  } else if (homepageLocationState === 'located') {
    buttonLabel.textContent = appText('تحديث موقعي');
    status.textContent = appText('تم تحديد موقعك. دقة الموقع التقريبية: {accuracy} مترًا.', { accuracy: appNumber(Math.round(homepageLocationAccuracy)) });
  } else if (homepageLocationState === 'error') {
    buttonLabel.textContent = appText('تحديث موقعي');
    status.textContent = appText(homepageLocationErrors[homepageLocationError] || 'تعذّر تحديد موقعك. حاول مجددًا.');
  } else if (homepageLocationState === 'unsupported') {
    buttonLabel.textContent = appText('تحديد موقعي');
    status.textContent = appText('تحديد الموقع غير متاح في هذا المتصفح. يمكنك استكشاف خريطة مكة.');
  } else {
    buttonLabel.textContent = appText('تحديد موقعي');
    status.textContent = appText('سيُطلب إذنك للوصول إلى الموقع.');
  }
}
$('#locate-button').addEventListener('click', () => {
  if (!navigator.geolocation) { homepageLocationState = 'unsupported'; renderHomepageLocationStatus(); return; }
  const button = $('#locate-button');
  button.disabled = true;
  homepageLocationState = 'requesting';
  renderHomepageLocationStatus();
  navigator.geolocation.getCurrentPosition(position => {
    const { latitude, longitude, accuracy } = position.coords;
    $('#main-map').src = mapUrl(latitude, longitude, .008);
    $('#open-location').href = externalMap(latitude, longitude);
    $('#map-caption').textContent = 'موقعك الحالي';
    $('#map-subtitle').textContent = 'حسب الموقع الذي أرسله جهازك';
    homepageLocationAccuracy = accuracy;
    homepageLocationState = 'located';
    button.disabled = false;
    renderHomepageLocationStatus();
  }, error => {
    homepageLocationError = error.code;
    homepageLocationState = 'error';
    button.disabled = false;
    renderHomepageLocationStatus();
  }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 });
});
function applySiteLocale() {
  refreshSiteLanguageControls();
  renderSchedule();
  renderDates();
  renderHomepageLocationStatus();
  const locale = window.I18n?.locale || 'ar';
  if (locale !== 'ar' && languages[locale]) chooseLanguage(locale, true);
  else if (selectedPhrase !== null) showPhrase(selectedPhrase);
  if (isRecording) $('#record-status').textContent = 'أستمع إليك… تحدّث بالعربية';
}
document.addEventListener('localechange', applySiteLocale);
applySiteLocale();
window.addEventListener('pagehide', () => { if (recognition && isRecording) recognition.abort(); if ('speechSynthesis' in window) window.speechSynthesis.cancel(); });
