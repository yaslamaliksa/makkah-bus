/* Interactive Makkah map: local Leaflet UI, OpenStreetMap tiles, and device geolocation. */
(() => {
  'use strict';
  const makkahCenter = [21.4225, 39.8262];
  let cityMap = null;
  let mapTiles = null;
  let tileErrors = false;
  let pointMarker = null;
  let userMarker = null;
  let accuracyCircle = null;
  const placeMarkers = new Map();
  const places = [
    { id: 'haram', name: 'المسجد الحرام', aliases: 'الحرم الكعبة الحرم المكي المسجد الحرام', category: 'قلب مكة المكرمة', description: 'المسجد الحرام والكعبة المشرفة، وجهة ضيوف الرحمن.', lat: 21.4225, lon: 39.8262 },
    { id: 'clock', name: 'أبراج الساعة', aliases: 'برج الساعة ابراج البيت برج الساعه', category: 'معلم عمراني', description: 'أبراج البيت ومعلم الساعة المطل على محيط المسجد الحرام.', lat: 21.4189, lon: 39.8260 },
    { id: 'hira', name: 'جبل النور وغار حراء', aliases: 'جبل النور غار حراء حرا كهف حراء', category: 'معلم تاريخي', description: 'جبل النور، الذي يقع فيه غار حراء، شمال شرق المسجد الحرام.', lat: 21.4588, lon: 39.8593 },
    { id: 'taneem', name: 'مسجد عائشة — التنعيم', aliases: 'مسجد عائشة عايشة التنعيم ميقات', category: 'مسجد وميقات', description: 'مسجد عائشة في منطقة التنعيم، أحد مواضع الإحرام للعمرة.', lat: 21.4686, lon: 39.8035 },
    { id: 'mina', name: 'منى', aliases: 'منى مني المشاعر الخيام', category: 'المشاعر المقدسة', description: 'مشعر منى، أحد المشاعر المقدسة المرتبطة بمناسك الحج.', lat: 21.4133, lon: 39.8933 },
    { id: 'arafat', name: 'عرفات', aliases: 'عرفات عرفة جبل الرحمة المشاعر', category: 'المشاعر المقدسة', description: 'مشعر عرفات وجبل الرحمة شرق مكة المكرمة.', lat: 21.3549, lon: 39.9840 }
  ];
  let destination = null;
  let coordinates = null;
  let locationRequest = 0;
  const pick = selector => document.querySelector(selector);
  const mapAnimation = () => !(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false);
  const escapeHtml = value => String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
  const normalize = value => value.normalize('NFKC').replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/[ـًٌٍَُِّْ]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
  function mapMarkerIcon(kind = 'landmark') {
    return window.L.divIcon({
      className: `makkah-map-marker ${kind}`,
      html: `<span class="map-marker-pin">${icon('pin')}</span>`,
      iconSize: [34, 42], iconAnchor: [17, 38], popupAnchor: [0, -35]
    });
  }
  function destroyMap() {
    if (cityMap) cityMap.remove();
    cityMap = null;
    mapTiles = null;
    pointMarker = null;
    userMarker = null;
    accuracyCircle = null;
    placeMarkers.clear();
  }
  function setMapStatus(message, failed = false) {
    const status = pick('#popup-map-status');
    if (!status) return;
    status.textContent = message;
    pick('#popup-map-retry').hidden = !failed;
  }
  function refreshMapLink() {
    if (!cityMap || !pick('#popup-map-link')) return;
    const center = cityMap.getCenter();
    const zoom = cityMap.getZoom();
    pick('#popup-map-link').href = `https://www.openstreetmap.org/#map=${zoom}/${center.lat.toFixed(5)}/${center.lng.toFixed(5)}`;
  }
  function showDestinationOnMap(place, recenter = true) {
    if (!cityMap || !place) return;
    placeMarkers.forEach((marker, id) => marker.setIcon(mapMarkerIcon(id === place.id ? 'selected' : 'landmark')));
    if (pointMarker) { cityMap.removeLayer(pointMarker); pointMarker = null; }
    const existingMarker = placeMarkers.get(place.id);
    if (existingMarker) existingMarker.openPopup();
    else {
      pointMarker = window.L.marker([place.lat, place.lon], {
        icon: mapMarkerIcon('selected'), title: place.name, alt: place.name, keyboard: true
      }).addTo(cityMap).bindPopup(`<div class="makkah-place-popup"><strong>${escapeHtml(place.name)}</strong><p>وجهتك المختارة</p></div>`).openPopup();
    }
    if (recenter) cityMap.setView([place.lat, place.lon], 15, { animate: mapAnimation() });
  }
  function showUserOnMap(recenter = true) {
    if (!cityMap || !coordinates) return;
    const latlng = [coordinates.latitude, coordinates.longitude];
    if (userMarker) cityMap.removeLayer(userMarker);
    if (accuracyCircle) cityMap.removeLayer(accuracyCircle);
    accuracyCircle = window.L.circle(latlng, {
      radius: Math.max(0, coordinates.accuracy), color: '#2f80bd', weight: 1,
      fillColor: '#5eabe2', fillOpacity: .12, interactive: false
    }).addTo(cityMap);
    userMarker = window.L.marker(latlng, {
      icon: window.L.divIcon({ className: 'makkah-user-marker', html: '<span></span>', iconSize: [22, 22], iconAnchor: [11, 11] }),
      title: 'موقعك الحالي', alt: 'موقعك الحالي', keyboard: true
    }).addTo(cityMap).bindPopup('<div class="makkah-place-popup"><strong>موقعك الحالي</strong><p>حسب موقع جهازك</p></div>');
    if (recenter) { cityMap.setView(latlng, 15, { animate: mapAnimation() }); userMarker.openPopup(); }
  }
  function selectMapPoint(latlng) {
    destination = {
      id: 'map-point', name: 'نقطة على الخريطة',
      description: `وجهة اخترتها على الخريطة: ${latlng.lat.toFixed(5)}, ${latlng.lng.toFixed(5)}`,
      lat: latlng.lat, lon: latlng.lng
    };
    pick('#destination-query').value = '';
    pick('#destination-results').hidden = true;
    pick('#destination-search-status').textContent = 'تم تحديد وجهتك على الخريطة. يمكنك فتح الاتجاهات إليها.';
    updateDestination();
    showDestinationOnMap(destination, false);
  }
  function initializeMap() {
    const container = pick('#interactive-makkah-map');
    if (!container || !window.L) {
      setMapStatus('تعذّر تشغيل الخريطة. أعد تحميل الصفحة أو افتح الخريطة من الرابط أدناه.');
      return;
    }
    cityMap = window.L.map(container, { zoomControl: false, scrollWheelZoom: false, zoomAnimation: mapAnimation(), fadeAnimation: mapAnimation(), markerZoomAnimation: mapAnimation() }).setView(makkahCenter, 13);
    const activeMap = cityMap;
    tileErrors = false;
    window.L.control.zoom({ position: 'topleft', zoomInTitle: 'تكبير الخريطة', zoomOutTitle: 'تصغير الخريطة' }).addTo(cityMap);
    cityMap.attributionControl.setPosition('bottomleft');
    mapTiles = window.L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>'
    });
    mapTiles.on('tileload', () => { if (cityMap === activeMap && !tileErrors) setMapStatus('اسحب لتحريك الخريطة، واستخدم + و − للتكبير. انقر على نقطة لتحديد وجهتك.'); });
    mapTiles.on('tileerror', () => { if (cityMap === activeMap) { tileErrors = true; setMapStatus('تعذّر تحميل جزء من الخريطة. تحقق من اتصالك أو أعد المحاولة.', true); } });
    mapTiles.addTo(cityMap);
    places.forEach(place => {
      const marker = window.L.marker([place.lat, place.lon], {
        icon: mapMarkerIcon(), title: place.name, alt: place.name, keyboard: true, bubblingMouseEvents: false
      }).addTo(cityMap).bindPopup(`<div class="makkah-place-popup"><strong>${escapeHtml(place.name)}</strong><p>${escapeHtml(place.category)}</p></div>`);
      marker.on('click', () => selectPlace(place.id, false, true));
      placeMarkers.set(place.id, marker);
    });
    cityMap.on('click', event => selectMapPoint(event.latlng));
    cityMap.on('moveend', refreshMapLink);
    refreshMapLink();
    if (destination) showDestinationOnMap(destination, false);
    if (coordinates) showUserOnMap(false);
    if (destination) cityMap.setView([destination.lat, destination.lon], 15, { animate: mapAnimation() });
    const sizeUpdate = () => { if (cityMap === activeMap) cityMap.invalidateSize({ pan: false }); };
    if (window.requestAnimationFrame) window.requestAnimationFrame(sizeUpdate);
    else sizeUpdate();
  }
  function directionsUrl(place) {
    const url = new URL('https://www.google.com/maps/dir/');
    url.searchParams.set('api', '1');
    url.searchParams.set('destination', `${place.lat},${place.lon}`);
    if (coordinates) url.searchParams.set('origin', `${coordinates.latitude},${coordinates.longitude}`);
    return url.href;
  }
  function placesMarkup() {
    return places.map(place => `<button type="button" class="landmark-chip" data-place="${place.id}" aria-pressed="${destination?.id === place.id}">${icon('pin')}<span>${place.name}</span></button>`).join('');
  }
  function popupMarkup() {
    return `<div class="makkah-popup">
      <section class="makkah-hero" aria-label="خريطة مكة المكرمة"><img src="assets/kaaba.jpg" alt="الكعبة المشرفة في المسجد الحرام" width="1600" height="1067"><div class="makkah-hero-shade"></div><div class="makkah-hero-title"><span>اكتشف وجهتك</span><h3 data-i18n="خريطة مكة" data-i18n-break>خريطة مكة</h3><p>رفيقك في استكشاف أم القرى</p></div><span class="makkah-hero-star" aria-hidden="true">✦</span></section>
      <section class="destination-section" aria-labelledby="destination-heading"><h3 class="gold-ribbon" id="destination-heading">أين تريد أن تذهب؟</h3><form id="destination-search" class="destination-search" role="search"><label class="sr-only" for="destination-query">ابحث في معالم مكة المعرّفة</label><input id="destination-query" type="search" placeholder="اكتب هنا مكانك المفضل…" autocomplete="off" maxlength="100" aria-controls="destination-results" aria-describedby="destination-hint"><button type="submit" aria-label="البحث عن وجهة">${icon('search')}</button></form><p class="destination-hint" id="destination-hint">ابحث في المعالم المتاحة: الحرم، غار حراء، التنعيم، منى…</p><div id="destination-results" class="destination-results" role="region" aria-label="نتائج البحث" hidden></div><p id="destination-search-status" class="sr-only" role="status"></p>
      <div class="destination-detail" id="destination-detail" hidden><div class="destination-pin">${icon('pin')}</div><div class="destination-info"><span>وجهتك المختارة</span><h4 id="destination-name"></h4><p id="destination-description"></p></div><a id="destination-directions" class="primary-button" target="_blank" rel="noopener noreferrer">${icon('arrow')}<span>الاتجاهات</span></a></div></section>
      <section class="popup-map-section" aria-labelledby="popup-map-heading"><div class="popup-map-heading"><div><p class="section-kicker">استكشف مكة وتعرّف على محيطك</p><h3 id="popup-map-heading">حدد وجهتك على الخريطة</h3></div><button class="popup-locate-button" id="popup-locate" type="button">${icon('target')}<span>تحديد موقعي</span></button></div><div class="popup-map-tools"><button type="button" id="popup-reset-map">${icon('pin')} العودة إلى مكة</button><button type="button" id="popup-all-landmarks">${icon('globe')} إظهار جميع المعالم</button></div><div class="popup-map-wrap"><div id="interactive-makkah-map" role="region" aria-label="خريطة تفاعلية لمكة المكرمة" aria-describedby="popup-map-status"></div></div><div class="popup-map-legend" aria-label="دليل رموز الخريطة"><span><i class="legend-landmark"></i> معالم مكة</span><span><i class="legend-destination"></i> وجهتك</span><span><i class="legend-user"></i> موقعك</span></div><div class="popup-map-footer"><span>${icon('globe')} خريطة مكة المكرمة التفاعلية</span><a id="popup-map-link" href="https://www.openstreetmap.org/#map=13/21.4225/39.8262" target="_blank" rel="noopener noreferrer">فتح الخريطة في صفحة مستقلة ${icon('external','tiny')}</a></div><div class="popup-map-status-row"><p class="popup-frame-help" id="popup-map-status" role="status">جارٍ تحميل خريطة مكة…</p><button type="button" id="popup-map-retry" hidden>إعادة المحاولة</button></div>
      <div class="popup-location-panel"><span class="popup-location-icon">${icon('target')}</span><div><strong>مكانك الآن</strong><p id="popup-location-status" role="status">اضغط على «تحديد موقعي» واسمح للمتصفح بالوصول إلى موقعك.</p><div class="popup-coordinate-row" id="popup-coordinate-row" hidden><bdi id="popup-coordinates"></bdi><a id="popup-position-link" target="_blank" rel="noopener noreferrer">عرض موقعي ${icon('external','tiny')}</a></div></div></div></section>
      <section class="popup-landmarks" aria-labelledby="landmarks-heading"><div class="landmarks-art"><img src="assets/makkah-landmarks.png" width="1672" height="941" loading="lazy" alt="رسم فني يضم المسجد الحرام والكعبة وأبراج الساعة وجبال مكة"><h3 class="gold-ribbon" id="landmarks-heading">أهم معالم مكة</h3><span class="art-caption">رسم توضيحي</span></div><p class="landmarks-intro">اختر معلمًا لمعرفة المزيد والحصول على الاتجاهات إليه.</p><div class="landmark-chips">${placesMarkup()}</div></section>
      <div class="popup-bottom-note">${icon('pin')} مكة المكرمة، وجهة تسكن القلب</div>
    </div>`;
  }
  function updateDestination() {
    if (!destination || !pick('#destination-detail')) return;
    pick('#destination-detail').hidden = false;
    pick('#destination-name').textContent = destination.name;
    pick('#destination-description').textContent = destination.description;
    const directions = pick('#destination-directions');
    directions.href = directionsUrl(destination);
    directions.setAttribute('aria-label', `الاتجاهات إلى ${destination.name} — تفتح في صفحة مستقلة`);
    document.querySelectorAll('.landmark-chip').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.place === destination.id)));
  }
  function selectPlace(id, fromSearch = false, fromMap = false) {
    const place = places.find(entry => entry.id === id);
    if (!place) return;
    destination = place;
    pick('#destination-query').value = window.I18n?.t(place.name) || place.name;
    pick('#destination-results').hidden = true;
    pick('#destination-search-status').textContent = `تم اختيار ${place.name} وإظهاره على الخريطة. يمكنك الآن فتح الاتجاهات.`;
    updateDestination();
    showDestinationOnMap(place);
    if (fromMap) return;
    if (fromSearch) pick('#destination-directions').focus();
    else {
      pick('#destination-detail').scrollIntoView?.({ behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' });
      pick('#destination-directions').focus({ preventScroll: true });
    }
  }
  function searchDestinations(submitted = false) {
    const input = pick('#destination-query');
    const query = input.value.trim();
    const results = pick('#destination-results');
    if (!query) {
      results.hidden = true;
      pick('#destination-search-status').textContent = submitted ? 'اكتب اسم معلم للبحث عنه.' : '';
      if (submitted) input.focus();
      return;
    }
    const normalized = normalize(query);
    const matches = places.filter(place => normalize(`${place.name} ${place.aliases} ${(window.I18n?.variants(place.name) || []).join(' ')}`).includes(normalized));
    if (submitted && matches.length === 1) { selectPlace(matches[0].id, true); return; }
    results.hidden = false;
    pick('#destination-search-status').textContent = matches.length ? `عدد المعالم المطابقة: ${matches.length}` : 'لا توجد نتائج ضمن المعالم المعرّفة. يمكنك البحث في صفحة مستقلة.';
    if (matches.length) {
      results.innerHTML = matches.map(place => `<button type="button" data-search-place="${place.id}">${icon('pin')}<span><strong>${place.name}</strong><small>${place.category}</small></span>${icon('arrow')}</button>`).join('');
    } else {
      const searchUrl = new URL('https://www.google.com/maps/search/');
      searchUrl.searchParams.set('api', '1');
      searchUrl.searchParams.set('query', `${query} مكة المكرمة`);
      results.innerHTML = `<p>لا توجد نتيجة ضمن المعالم المعرّفة في هذا الدليل.</p><a target="_blank" rel="noopener noreferrer" href="${escapeHtml(searchUrl.href)}">البحث عن «${escapeHtml(query)}» في خرائط Google ${icon('external','tiny')}</a>`;
    }
  }
  function updatePosition() {
    if (!coordinates || !pick('#popup-location-status')) return;
    pick('#popup-location-status').textContent = `تم تحديد موقعك. الدقة التقريبية: ${window.I18n?.formatNumber(Math.round(coordinates.accuracy)) || Math.round(coordinates.accuracy).toLocaleString('ar-SA')} مترًا.`;
    pick('#popup-coordinate-row').hidden = false;
    pick('#popup-coordinates').textContent = `${coordinates.latitude.toFixed(5)}, ${coordinates.longitude.toFixed(5)}`;
    pick('#popup-position-link').href = externalMap(coordinates.latitude, coordinates.longitude);
    pick('#popup-locate span').textContent = 'تحديث موقعي';
    updateDestination();
  }
  function locate() {
    const status = pick('#popup-location-status');
    const button = pick('#popup-locate');
    if (!navigator.geolocation) { status.textContent = 'تحديد الموقع غير مدعوم في هذا المتصفح. يمكنك اختيار وجهتك وفتح الاتجاهات.'; return; }
    const request = ++locationRequest;
    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
    button.querySelector('span').textContent = 'جارٍ تحديد الموقع…';
    status.textContent = 'بانتظار إذنك للوصول إلى الموقع…';
    const isCurrent = () => request === locationRequest && dialog.open && dialog.classList.contains('makkah-dialog');
    const reset = () => { button.disabled = false; button.removeAttribute('aria-busy'); button.querySelector('span').textContent = coordinates ? 'تحديث موقعي' : 'تحديد موقعي'; };
    navigator.geolocation.getCurrentPosition(position => {
      if (!isCurrent()) return;
      const { latitude, longitude, accuracy } = position.coords;
      coordinates = { latitude, longitude, accuracy };
      reset();
      updatePosition();
      showUserOnMap();
    }, error => {
      if (!isCurrent()) return;
      const errors = { 1: 'لم يُمنح إذن الموقع. اسمح بالوصول من إعدادات المتصفح ثم حاول مجددًا.', 2: 'تعذّر الوصول إلى موقعك. تأكد من تفعيل خدمات الموقع.', 3: 'انتهت مهلة تحديد الموقع. حاول مرة أخرى في مكان تتوفر فيه إشارة أفضل.' };
      status.textContent = errors[error.code] || 'تعذّر تحديد الموقع. يمكنك اختيار وجهة والحصول على الاتجاهات.';
      reset();
    }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 });
  }
  function openMakkahMap() {
    ++locationRequest;
    destroyMap();
    openDialog('خريطة مكة', 'اكتشف وجهتك في أم القرى', popupMarkup());
    dialog.classList.add('makkah-dialog');
    dialog.scrollTop = 0;
    initializeMap();
    pick('#destination-search').addEventListener('submit', event => { event.preventDefault(); searchDestinations(true); });
    pick('#destination-query').addEventListener('input', () => {
      if (destination && normalize(pick('#destination-query').value) !== normalize(window.I18n?.t(destination.name) || destination.name)) {
        destination = null;
        pick('#destination-detail').hidden = true;
        document.querySelectorAll('.landmark-chip').forEach(button => button.setAttribute('aria-pressed', 'false'));
        placeMarkers.forEach(marker => marker.setIcon(mapMarkerIcon()));
        if (cityMap && pointMarker) { cityMap.removeLayer(pointMarker); pointMarker = null; }
      }
      searchDestinations();
    });
    pick('#destination-query').addEventListener('keydown', event => {
      if (event.key === 'Escape' && !pick('#destination-results').hidden) { event.preventDefault(); event.stopPropagation(); pick('#destination-results').hidden = true; }
      else if (event.key === 'ArrowDown' && !pick('#destination-results').hidden) { const first = pick('#destination-results button, #destination-results a'); if (first) { event.preventDefault(); first.focus(); } }
    });
    pick('#destination-results').addEventListener('click', event => { const button = event.target.closest('[data-search-place]'); if (button) selectPlace(button.dataset.searchPlace, true); });
    pick('.landmark-chips').addEventListener('click', event => { const button = event.target.closest('[data-place]'); if (button) selectPlace(button.dataset.place); });
    pick('#popup-locate').addEventListener('click', locate);
    pick('#popup-reset-map').addEventListener('click', () => { if (cityMap) { cityMap.closePopup(); cityMap.setView(makkahCenter, 13, { animate: mapAnimation() }); } });
    pick('#popup-all-landmarks').addEventListener('click', () => { if (cityMap) cityMap.fitBounds(places.map(place => [place.lat, place.lon]), { padding: [35, 35], maxZoom: 14, animate: mapAnimation() }); });
    pick('#popup-map-retry').addEventListener('click', () => { if (mapTiles) { tileErrors = false; setMapStatus('جارٍ إعادة تحميل الخريطة…'); mapTiles.redraw(); } });
    if (destination) { pick('#destination-query').value = window.I18n?.t(destination.name) || destination.name; updateDestination(); }
    updatePosition();
  }
  document.addEventListener('localechange', () => {
    if (!dialog.open || !dialog.classList.contains('makkah-dialog')) return;
    if (destination) {
      pick('#destination-query').value = window.I18n?.t(destination.name) || destination.name;
      updateDestination();
    }
    if (coordinates) updatePosition();
    // Leaflet caches measured popup dimensions; refresh after labels change.
    if (cityMap) {
      cityMap.invalidateSize({ pan: false });
      placeMarkers.forEach(marker => marker.getPopup?.()?.update());
      pointMarker?.getPopup?.()?.update();
      userMarker?.getPopup?.()?.update();
    }
  });
  pick('#open-makkah-map').addEventListener('click', openMakkahMap);
  dialog.addEventListener('close', () => { ++locationRequest; destroyMap(); dialog.classList.remove('makkah-dialog'); });
})();
