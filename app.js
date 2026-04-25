/* ─── State ──────────────────────────────────────────────────────────────────── */
const state = {
  view: 'month',          // 'month' | 'week' | 'day'
  cursor: new Date(),     // currently viewed date
  today: new Date(),
  events: [],
  editId: null,
  activeFilters: new Set(['high', 'medium', 'low']),
  selectedColor: '#4f46e5',
  miniCursor: new Date(),
};

/* ─── Persistence ────────────────────────────────────────────────────────────── */
async function fetchEvents() {
  try {
    const res = await fetch('/api/events');
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}
async function saveEvents() {
  try {
    await fetch('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(state.events)
    });
  } catch (e) {
    console.error('Speichern fehlgeschlagen:', e);
  }
}
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

/* ─── Date Helpers ───────────────────────────────────────────────────────────── */
const MONTHS_DE = ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];
const DAYS_DE   = ['Montag','Dienstag','Mittwoch','Donnerstag','Freitag','Samstag','Sonntag'];
const DAYS_SHORT = ['Mo','Di','Mi','Do','Fr','Sa','So'];

function toYMD(d) {
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
}
function pad(n) { return String(n).padStart(2,'0'); }
function sameDay(a, b) { return toYMD(a) === toYMD(b); }

// Monday = 0, ..., Sunday = 6
function weekdayMon(d) { return (d.getDay() + 6) % 7; }

function startOfWeek(d) {
  const copy = new Date(d);
  copy.setDate(copy.getDate() - weekdayMon(copy));
  return copy;
}

function addDays(d, n) {
  const c = new Date(d);
  c.setDate(c.getDate() + n);
  return c;
}

function formatDate(d) {
  return `${DAYS_DE[weekdayMon(d)]}, ${d.getDate()}. ${MONTHS_DE[d.getMonth()]} ${d.getFullYear()}`;
}

/* ─── Filtered Events ────────────────────────────────────────────────────────── */
function visibleEvents() {
  return state.events.filter(e => state.activeFilters.has(e.priority));
}

function eventsForDay(ymd) {
  return visibleEvents().filter(e => e.date === ymd).sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''));
}

/* ─── Render Router ──────────────────────────────────────────────────────────── */
function render() {
  // Refresh today's date on every render so midnight drift is caught automatically
  state.today = new Date();
  renderMiniCal();
  renderPeriodLabel();
  const container = document.getElementById('calendarContainer');
  if      (state.view === 'month')    renderMonth(container);
  else if (state.view === 'week')     renderWeek(container);
  else if (state.view === 'twoweek') renderTwoWeeks(container);
  else                                renderDay(container);
}

/* ─── Period Label ───────────────────────────────────────────────────────────── */
function renderPeriodLabel() {
  const el = document.getElementById('currentPeriod');
  const c = state.cursor;
  if (state.view === 'month') {
    el.textContent = `${MONTHS_DE[c.getMonth()]} ${c.getFullYear()}`;
  } else if (state.view === 'week') {
    const start = startOfWeek(c);
    const end   = addDays(start, 6);
    if (start.getMonth() === end.getMonth()) {
      el.textContent = `${start.getDate()}. – ${end.getDate()}. ${MONTHS_DE[start.getMonth()]} ${start.getFullYear()}`;
    } else {
      el.textContent = `${start.getDate()}. ${MONTHS_DE[start.getMonth()]} – ${end.getDate()}. ${MONTHS_DE[end.getMonth()]} ${start.getFullYear()}`;
    }
  } else if (state.view === 'twoweek') {
    const s1 = startOfWeek(c);
    const e2 = addDays(s1, 13);
    el.textContent = `KW ${getWeekNumber(s1)}–${getWeekNumber(addDays(s1, 7))} · ` +
      `${s1.getDate()}. ${MONTHS_DE[s1.getMonth()]} – ${e2.getDate()}. ${MONTHS_DE[e2.getMonth()]} ${e2.getFullYear()}`;
  } else {
    el.textContent = formatDate(c);
  }
}

/* ─── Month View ─────────────────────────────────────────────────────────────── */
function renderMonth(container) {
  const year = state.cursor.getFullYear();
  const month = state.cursor.getMonth();

  // Grid start: Monday of the week containing the 1st
  const firstDay = new Date(year, month, 1);
  const gridStart = startOfWeek(firstDay);

  let html = `<div class="month-grid">`;

  // Header row
  html += `<div class="month-header">`;
  DAYS_SHORT.forEach(d => { html += `<div class="month-header-cell">${d}</div>`; });
  html += `</div>`;

  html += `<div class="month-body">`;

  for (let week = 0; week < 6; week++) {
    html += `<div class="month-week">`;
    for (let dow = 0; dow < 7; dow++) {
      const cellDate = addDays(gridStart, week * 7 + dow);
      const ymd = toYMD(cellDate);
      const isToday = sameDay(cellDate, state.today);
      const isOther = cellDate.getMonth() !== month;

      let cls = 'month-cell';
      if (isOther) cls += ' other-month';
      if (isToday) cls += ' today';

      const dayEvents = eventsForDay(ymd);
      const maxShow = 3;
      const shown = dayEvents.slice(0, maxShow);
      const extra = dayEvents.length - maxShow;

      let evHtml = shown.map(e => eventPill(e)).join('');
      if (extra > 0) evHtml += `<div class="more-link">+${extra} weitere</div>`;

      html += `<div class="${cls}" data-date="${ymd}">
        <div class="day-num">${cellDate.getDate()}</div>
        ${evHtml}
      </div>`;
    }
    html += `</div>`;
  }

  html += `</div></div>`;
  container.innerHTML = html;
  attachCellListeners(container);
}

function eventPill(e) {
  const pColor = priorityColor(e.priority);
  return `<div class="event-pill" style="background:${e.color};border:2px solid ${pColor}" data-id="${e.id}">
    <span class="pill-title">${escHtml(e.title)}</span>
  </div>`;
}

/* ─── Week / Day shared helpers ─────────────────────────────────────────────── */
const HOUR_H = 60; // px per hour

// Builds the HTML for a single day column used in week + two-week view
function buildWkDayCol(d) {
  const ymd     = toYMD(d);
  const isToday = sameDay(d, state.today);
  let h = `<div class="wk-day-col${isToday ? ' today-col' : ''}">`;

  for (let hr = 0; hr < 24; hr++) {
    h += `<div class="wk-hour-slot" data-date="${ymd}" data-hour="${hr}" style="top:${hr * HOUR_H}px"></div>`;
  }

  const layout = computeOverlapLayout(eventsForDay(ymd));
  eventsForDay(ymd).forEach(ev => {
    const { col, totalCols, isEarlier } = layout.get(ev.id);
    const startMins = timeToMins(ev.startTime || '00:00');
    const endMins   = timeToMins(ev.endTime   || '') || startMins + 60;
    const duration  = Math.max(endMins - startMins, 15);
    const top       = startMins * (HOUR_H / 60);
    const height    = duration  * (HOUR_H / 60);
    const colW      = 100 / totalCols;
    const leftPct   = col * colW;
    const pColor    = priorityColor(ev.priority);
    const timeLabel = ev.startTime ? `${ev.startTime}${ev.endTime ? '–' + ev.endTime : ''}` : '';
    const zIndex    = isEarlier ? 1 : 2;
    h += `<div class="wk-event" style="top:${top}px;height:${height}px;` +
      `left:calc(${leftPct}% + 3px);width:calc(${colW}% - 6px);` +
      `background:${ev.color};border:3px solid ${pColor};z-index:${zIndex}" data-id="${ev.id}">` +
      `<div class="wk-event-title">${escHtml(ev.title)}</div>` +
      (height >= 36 ? `<div class="wk-event-time">${timeLabel}</div>` : '') +
      (ev.description && height >= 52 ? `<div class="wk-event-desc">${escHtml(ev.description)}</div>` : '') +
      `</div>`;
  });

  return h + `</div>`;
}

// Builds the time-label column HTML (shared)
function buildTimeCol() {
  let h = `<div class="wk-time-col">`;
  for (let hr = 1; hr < 24; hr++) {
    h += `<div class="wk-hour-label" style="top:${hr * HOUR_H}px">${pad(hr)}:00</div>`;
  }
  return h + `</div>`;
}

/* ─── Week View ──────────────────────────────────────────────────────────────── */

function timeToMins(t) {
  if (!t) return 0;
  const [h, m] = t.split(':').map(Number);
  return h * 60 + (m || 0);
}

function hexToRgba(hex, alpha) {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function priorityColor(p) {
  return { high: '#ef4444', medium: '#f59e0b', low: '#10b981' }[p] || '#94a3b8';
}

// Returns Map<id, { col, totalCols, isEarlier }>
function computeOverlapLayout(events) {
  if (!events.length) return new Map();

  const sorted = [...events].sort((a, b) =>
    timeToMins(a.startTime || '00:00') - timeToMins(b.startTime || '00:00')
  );

  const colOf   = new Map();
  const colEnds = [];

  for (const ev of sorted) {
    const s = timeToMins(ev.startTime || '00:00');
    const e = timeToMins(ev.endTime   || '') || s + 60;
    let col = 0;
    while (col < colEnds.length && colEnds[col] > s) col++;
    if (col === colEnds.length) colEnds.push(e);
    else colEnds[col] = Math.max(colEnds[col], e);
    colOf.set(ev.id, col);
  }

  const result = new Map();
  for (const ev of sorted) {
    const s1 = timeToMins(ev.startTime || '00:00');
    const e1 = timeToMins(ev.endTime   || '') || s1 + 60;

    const overlaps = sorted.filter(o => {
      if (o.id === ev.id) return false;
      const s2 = timeToMins(o.startTime || '00:00');
      const e2 = timeToMins(o.endTime   || '') || s2 + 60;
      return s1 < e2 && e1 > s2;
    });

    const totalCols = overlaps.length
      ? Math.max(colOf.get(ev.id), ...overlaps.map(o => colOf.get(o.id))) + 1
      : 1;

    // isEarlier: overlaps with at least one event that starts at the same time or later
    const isEarlier = overlaps.some(o => timeToMins(o.startTime || '00:00') >= s1);

    result.set(ev.id, { col: colOf.get(ev.id), totalCols, isEarlier });
  }
  return result;
}

function renderWeek(container) {
  const weekStart = startOfWeek(state.cursor);
  const days = Array.from({length: 7}, (_, i) => addDays(weekStart, i));

  let html = `<div class="week-grid">`;

  // Header
  html += `<div class="week-header"><div class="week-header-cell"></div>`;
  days.forEach(d => {
    const isToday = sameDay(d, state.today);
    html += `<div class="week-header-cell${isToday ? ' today-col' : ''}">
      <div style="font-size:11px;text-transform:uppercase;letter-spacing:.5px">${DAYS_SHORT[weekdayMon(d)]}</div>
      <div class="wk-date">${d.getDate()}</div>
    </div>`;
  });
  html += `</div>`;

  // Scrollable body
  html += `<div class="week-scroll"><div class="wk-time-body">`;
  html += buildTimeCol();
  days.forEach(d => { html += buildWkDayCol(d); });

  html += `</div></div></div>`;
  container.innerHTML = html;

  // Scroll to 07:00 on initial render
  const scrollEl = container.querySelector('.week-scroll');
  if (scrollEl) scrollEl.scrollTop = 7 * HOUR_H;

  attachCellListeners(container);
}

/* ─── Two-Week View ──────────────────────────────────────────────────────────── */
function renderTwoWeeks(container) {
  const ws1  = startOfWeek(state.cursor);
  const ws2  = addDays(ws1, 7);

  let html = `<div class="twoweek-grid"><div class="twoweek-scroll">`;

  [ws1, ws2].forEach(ws => {
    const days = Array.from({length: 7}, (_, i) => addDays(ws, i));

    // Week label bar
    html += `<div class="twoweek-week-label-bar">KW ${getWeekNumber(ws)}</div>`;

    // Day header
    html += `<div class="twoweek-day-header">`;
    html += `<div class="twoweek-time-gutter"></div>`;
    days.forEach(d => {
      const isToday = sameDay(d, state.today);
      html += `<div class="twoweek-header-cell${isToday ? ' today-col' : ''}">
        <div class="twoweek-day-name">${DAYS_SHORT[weekdayMon(d)]}</div>
        <div class="wk-date">${d.getDate()}.${pad(d.getMonth() + 1)}</div>
      </div>`;
    });
    html += `</div>`;

    // Time body
    html += `<div class="wk-time-body twoweek-body">`;
    html += buildTimeCol();
    days.forEach(d => { html += buildWkDayCol(d); });
    html += `</div>`;
  });

  html += `</div></div>`;
  container.innerHTML = html;

  const scrollEl = container.querySelector('.twoweek-scroll');
  if (scrollEl) scrollEl.scrollTop = 7 * HOUR_H;

  attachCellListeners(container);
}

/* ─── Day View ───────────────────────────────────────────────────────────────── */
function renderDay(container) {
  const d      = state.cursor;
  const ymd    = toYMD(d);
  const isToday = sameDay(d, state.today);

  let html = `<div class="day-grid">
    <div class="day-header">
      <div class="day-title">${d.getDate()}. ${MONTHS_DE[d.getMonth()]} ${d.getFullYear()}</div>
      <div class="day-sub">${DAYS_DE[weekdayMon(d)]}${isToday ? ' — Heute' : ''}</div>
    </div>
    <div class="day-scroll"><div class="day-time-body">`;

  // Time label column
  html += `<div class="day-time-col">`;
  for (let h = 1; h < 24; h++) {
    html += `<div class="day-hour-label" style="top:${h * HOUR_H}px">${pad(h)}:00</div>`;
  }
  html += `</div>`;

  // Events column
  html += `<div class="day-events-col">`;

  // Hour slots as click targets + grid lines
  for (let h = 0; h < 24; h++) {
    html += `<div class="day-hour-slot" data-date="${ymd}" data-hour="${h}" style="top:${h * HOUR_H}px"></div>`;
  }

  // Events — absolutely positioned with overlap layout
  const layout = computeOverlapLayout(eventsForDay(ymd));
  eventsForDay(ymd).forEach(ev => {
    const { col, totalCols } = layout.get(ev.id);
    const startMins = timeToMins(ev.startTime || '00:00');
    const endMins   = timeToMins(ev.endTime   || '') || startMins + 60;
    const duration  = Math.max(endMins - startMins, 15);
    const top       = startMins * (HOUR_H / 60);
    const height    = duration  * (HOUR_H / 60);
    const colW      = 100 / totalCols;
    const leftPct   = col * colW;
    const pColor    = priorityColor(ev.priority);
    const timeLabel = ev.startTime ? `${ev.startTime}${ev.endTime ? '–' + ev.endTime : ''}` : '';
    html += `<div class="day-event" style="top:${top}px;height:${height}px;` +
      `left:calc(${leftPct}% + 4px);width:calc(${colW}% - 8px);` +
      `background:${ev.color};border:3px solid ${pColor}" data-id="${ev.id}">
      <div class="day-event-title">${escHtml(ev.title)}</div>
      ${height >= 36 ? `<div class="day-event-time">${timeLabel}</div>` : ''}
      ${ev.description && height >= 52 ? `<div class="day-event-desc">${escHtml(ev.description)}</div>` : ''}
    </div>`;
  });

  html += `</div></div></div></div>`;
  container.innerHTML = html;

  // Scroll to 07:00
  const scrollEl = container.querySelector('.day-scroll');
  if (scrollEl) scrollEl.scrollTop = 7 * HOUR_H;

  attachCellListeners(container);
}

function eventBlock(e) {
  const time   = e.startTime ? `${e.startTime}${e.endTime ? '–'+e.endTime : ''}` : '';
  const pColor = priorityColor(e.priority);
  return `<div class="event-block" style="background:${e.color};border:2px solid ${pColor}" data-id="${e.id}">
    <div>
      <div class="block-title">${escHtml(e.title)}</div>
      ${time ? `<div class="block-time">${time}</div>` : ''}
    </div>
  </div>`;
}

/* ─── Cell / Event Click Listeners ──────────────────────────────────────────── */
function attachCellListeners(container) {
  // Month cells → create on click
  container.querySelectorAll('.month-cell').forEach(cell => {
    cell.addEventListener('click', e => {
      if (e.target.closest('.event-pill, .more-link')) return;
      openModal(null, cell.dataset.date, null);
    });
  });

  // Week hour slots → create on click
  container.querySelectorAll('.wk-hour-slot').forEach(slot => {
    slot.addEventListener('click', e => {
      e.stopPropagation();
      openModal(null, slot.dataset.date, slot.dataset.hour);
    });
  });

  // Day hour slots → create on click
  container.querySelectorAll('.day-hour-slot').forEach(slot => {
    slot.addEventListener('click', e => {
      e.stopPropagation();
      openModal(null, slot.dataset.date, slot.dataset.hour);
    });
  });

  // Month event pills → popup
  container.querySelectorAll('.event-pill').forEach(el => {
    el.addEventListener('click', e => {
      e.stopPropagation();
      const ev = state.events.find(ev => ev.id === el.dataset.id);
      if (ev) showPopup(ev, el);
    });
  });

  // Week events → popup
  container.querySelectorAll('.wk-event').forEach(el => {
    el.addEventListener('click', e => {
      e.stopPropagation();
      const ev = state.events.find(ev => ev.id === el.dataset.id);
      if (ev) showPopup(ev, el);
    });
  });

  // Day events → popup
  container.querySelectorAll('.day-event').forEach(el => {
    el.addEventListener('click', e => {
      e.stopPropagation();
      const ev = state.events.find(ev => ev.id === el.dataset.id);
      if (ev) showPopup(ev, el);
    });
  });
}

/* ─── Mini Calendar ──────────────────────────────────────────────────────────── */
function renderMiniCal() {
  const mc = state.miniCursor;
  const year = mc.getFullYear();
  const month = mc.getMonth();
  document.getElementById('miniTitle').textContent = `${MONTHS_DE[month]} ${year}`;

  const firstDay = new Date(year, month, 1);
  const gridStart = startOfWeek(firstDay);

  const daysEl = document.getElementById('miniDays');
  daysEl.innerHTML = '';

  for (let i = 0; i < 42; i++) {
    const d = addDays(gridStart, i);
    const div = document.createElement('div');
    div.className = 'mini-day';
    div.textContent = d.getDate();
    if (d.getMonth() !== month) div.classList.add('other-month');
    if (sameDay(d, state.today)) div.classList.add('today');
    if (sameDay(d, state.cursor)) div.classList.add('selected');
    div.addEventListener('click', () => {
      state.cursor = new Date(d);
      if (state.view === 'month') {
        state.cursor = new Date(d.getFullYear(), d.getMonth(), 1);
      }
      render();
    });
    daysEl.appendChild(div);
  }
}

/* ─── Modal ──────────────────────────────────────────────────────────────────── */
function openModal(id, date, hour) {
  state.editId = id || null;
  const overlay = document.getElementById('modalOverlay');
  const delBtn  = document.getElementById('btnDeleteEvt');

  if (id) {
    const ev = state.events.find(e => e.id === id);
    document.getElementById('modalTitle').textContent = 'Termin bearbeiten';
    document.getElementById('evtTitle').value    = ev.title;
    document.getElementById('evtDate').value     = ev.date;
    document.getElementById('evtPriority').value = ev.priority;
    document.getElementById('evtStart').value    = ev.startTime || '09:00';
    document.getElementById('evtEnd').value      = ev.endTime   || '10:00';
    document.getElementById('evtDesc').value     = ev.description || '';
    setColor(ev.color);
    delBtn.style.display = 'inline-flex';
  } else {
    document.getElementById('modalTitle').textContent = 'Termin erstellen';
    document.getElementById('evtTitle').value    = 'Arbeit';
    document.getElementById('evtDate').value     = date || toYMD(state.today);
    document.getElementById('evtPriority').value = 'medium';
    document.getElementById('evtStart').value    = hour != null ? `${pad(hour)}:00` : '09:00';
    document.getElementById('evtEnd').value      = hour != null ? (+hour < 23 ? `${pad(+hour + 1)}:00` : '23:59') : '10:00';
    document.getElementById('evtDesc').value     = '';
    setColor('#4f46e5');
    delBtn.style.display = 'none';
  }

  // Sync quick-select button highlights
  syncTimeQuick('evtStart');
  syncTimeQuick('evtEnd');
  syncPriorityColor();

  overlay.classList.add('open');
  document.getElementById('evtTitle').focus();
}

function syncTimeQuick(inputId) {
  const val = document.getElementById(inputId).value;
  document.querySelectorAll(`.time-quick[data-target="${inputId}"]`).forEach(btn => {
    btn.classList.toggle('active', btn.dataset.value === val);
  });
}

function syncPriorityColor() {
  const val     = document.getElementById('evtPriority').value;
  const trigger = document.getElementById('prioTrigger');
  const label   = document.getElementById('prioLabel');
  const LABELS  = { high: 'Hoch', medium: 'Mittel', low: 'Niedrig' };
  const CLASSES = { high: 'prio-high', medium: 'prio-medium', low: 'prio-low' };
  trigger.className = 'prio-trigger ' + (CLASSES[val] || '');
  label.textContent = LABELS[val] || val;
  document.querySelectorAll('.prio-option').forEach(o => {
    o.classList.toggle('selected', o.dataset.value === val);
    // Ensure checkmark span exists
    if (!o.querySelector('.prio-check')) {
      const chk = document.createElement('span');
      chk.className = 'prio-check';
      chk.textContent = '✓';
      o.appendChild(chk);
    }
  });
}

function closeModal() {
  document.getElementById('modalOverlay').classList.remove('open');
}

function setColor(hex) {
  state.selectedColor = hex;
  document.getElementById('evtColor').value = hex;
  document.querySelectorAll('.swatch').forEach(s => {
    s.classList.toggle('active', s.dataset.color === hex);
  });
}

function saveEvent() {
  const title = document.getElementById('evtTitle').value.trim();
  if (!title) { document.getElementById('evtTitle').focus(); return; }

  const startVal = document.getElementById('evtStart').value;
  const endVal   = document.getElementById('evtEnd').value;
  if (startVal && endVal && timeToMins(endVal) <= timeToMins(startVal)) {
    document.getElementById('evtEnd').style.borderColor = '#ef4444';
    document.getElementById('evtEnd').focus();
    setTimeout(() => document.getElementById('evtEnd').style.borderColor = '', 1500);
    return;
  }

  const existing = state.editId ? state.events.find(e => e.id === state.editId) : null;
  const ev = {
    id:          state.editId || uid(),
    createdAt:   existing?.createdAt ?? Date.now(),
    title,
    date:        document.getElementById('evtDate').value,
    priority:    document.getElementById('evtPriority').value,
    startTime:   document.getElementById('evtStart').value,
    endTime:     document.getElementById('evtEnd').value,
    color:       state.selectedColor,
    description: document.getElementById('evtDesc').value.trim(),
  };

  if (state.editId) {
    const idx = state.events.findIndex(e => e.id === state.editId);
    if (idx !== -1) state.events[idx] = ev;
  } else {
    state.events.push(ev);
  }

  saveEvents();
  closeModal();
  render();
}

function deleteEvent(id) {
  const ev = state.events.find(e => e.id === id);
  const age = ev ? (Date.now() - (ev.createdAt || 0)) : Infinity;
  const TWO_HOURS = 2 * 60 * 60 * 1000;
  if (age > TWO_HOURS && !confirm('Termin wirklich löschen?')) return;
  state.events = state.events.filter(e => e.id !== id);
  saveEvents();
  closeModal();
  hidePopup();
  render();
}

/* ─── Event Detail Popup ─────────────────────────────────────────────────────── */
function showPopup(ev, anchor) {
  const popup = document.getElementById('eventPopup');
  const header = document.getElementById('popupHeader');
  header.style.background = ev.color;
  document.getElementById('popupTitle').textContent = ev.title;

  const d = new Date(ev.date + 'T00:00:00');
  document.getElementById('popupDate').textContent = `📅 ${formatDate(d)}`;

  const time = ev.startTime ? `⏰ ${ev.startTime}${ev.endTime ? ' – ' + ev.endTime : ''}` : '';
  document.getElementById('popupTime').textContent = time;
  document.getElementById('popupTime').style.display = time ? '' : 'none';

  const pLabels = { high: 'Hoch', medium: 'Mittel', low: 'Niedrig' };
  document.getElementById('popupPriority').innerHTML =
    `<span class="priority-badge ${ev.priority}">${pLabels[ev.priority]}</span>`;

  const desc = document.getElementById('popupDesc');
  desc.textContent = ev.description || '';
  desc.style.display = ev.description ? '' : 'none';
  desc.className = 'desc';

  // Position near anchor
  const rect = anchor.getBoundingClientRect();
  const pw = 260, ph = 160;
  let left = rect.right + 8;
  let top  = rect.top;
  if (left + pw > window.innerWidth)  left = rect.left - pw - 8;
  if (top  + ph > window.innerHeight) top  = window.innerHeight - ph - 8;
  popup.style.left = `${Math.max(4, left)}px`;
  popup.style.top  = `${Math.max(4, top)}px`;

  popup.dataset.evId = ev.id;
  popup.classList.add('show');
}

function hidePopup() {
  document.getElementById('eventPopup').classList.remove('show');
}

/* ─── Navigation ─────────────────────────────────────────────────────────────── */
function navigate(dir) {
  const c = state.cursor;
  if (state.view === 'month') {
    state.cursor = new Date(c.getFullYear(), c.getMonth() + dir, 1);
  } else if (state.view === 'week') {
    state.cursor = addDays(c, dir * 7);
  } else if (state.view === 'twoweek') {
    state.cursor = addDays(c, dir * 14);
  } else {
    state.cursor = addDays(c, dir);
  }
  render();
}

/* ─── Escape HTML ────────────────────────────────────────────────────────────── */
function escHtml(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

/* ─── Quick Entry ────────────────────────────────────────────────────────────── */
const QUICK_PRESETS = [
  { id: 'p1', name: 'Frühschicht', startTime: '05:30', endTime: '13:30', color: '#7c3aed', priority: 'medium' },
  { id: 'p2', name: 'Spätschicht', startTime: '13:30', endTime: '21:30', color: '#ca8a04', priority: 'medium' },
];

const quickState = {
  weekStart: null,       // Monday of selected week
  activePreset: 'p1',   // only one preset active at a time
  selected: { p1: new Set(), p2: new Set() },
};

function selectAllWeekdays() {
  for (let i = 0; i < 5; i++) quickState.selected[quickState.activePreset].add(i);
}

function setActivePreset(presetId) {
  quickState.activePreset = presetId;
  // Clear the inactive preset's selection
  QUICK_PRESETS.forEach(p => { if (p.id !== presetId) quickState.selected[p.id].clear(); });
}

function openQuickModal() {
  quickState.weekStart = startOfWeek(state.today);
  quickState.activePreset = 'p1';
  quickState.selected.p1.clear();
  quickState.selected.p2.clear();
  selectAllWeekdays();
  renderQuickModal();
  document.getElementById('quickOverlay').classList.add('open');
}

function closeQuickModal() {
  document.getElementById('quickOverlay').classList.remove('open');
}

function renderQuickModal() {
  // Week label
  const ws = quickState.weekStart;
  const we = addDays(ws, 4);
  document.getElementById('quickWeekLabel').textContent =
    `KW ${getWeekNumber(ws)} · ${ws.getDate()}.${pad(ws.getMonth()+1)} – ${we.getDate()}.${pad(we.getMonth()+1)}.${we.getFullYear()}`;

  QUICK_PRESETS.forEach((preset, idx) => {
    const num = idx + 1;
    const isActive = quickState.activePreset === preset.id;

    // Active/inactive styling on the card
    const card = document.getElementById(`quickPreset${num}`);
    card.classList.toggle('active', isActive);
    card.classList.toggle('inactive', !isActive);

    // Day buttons
    const container = document.getElementById(`quickDays${num}`);
    container.innerHTML = '';
    const DAY_LABELS = ['Mo', 'Di', 'Mi', 'Do', 'Fr'];
    DAY_LABELS.forEach((label, i) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'quick-day-btn' + (quickState.selected[preset.id].has(i) ? ' active' : '');
      btn.textContent = label;
      btn.title = formatDate(addDays(quickState.weekStart, i));
      btn.addEventListener('click', () => {
        if (quickState.selected[preset.id].has(i)) quickState.selected[preset.id].delete(i);
        else quickState.selected[preset.id].add(i);
        renderQuickModal();
      });
      container.appendChild(btn);
    });
  });
}

function getWeekNumber(d) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
}

function saveQuickEntries() {
  let added = 0;
  QUICK_PRESETS.forEach(preset => {
    quickState.selected[preset.id].forEach(dayIndex => {
      const date = addDays(quickState.weekStart, dayIndex);
      const ymd  = toYMD(date);
      // Avoid duplicates: skip if same preset already exists on that day
      const exists = state.events.some(
        e => e.date === ymd && e.startTime === preset.startTime && e.title === preset.name
      );
      if (!exists) {
        state.events.push({
          id:          uid(),
          createdAt:   Date.now(),
          title:       preset.name,
          date:        ymd,
          priority:    preset.priority,
          startTime:   preset.startTime,
          endTime:     preset.endTime,
          color:       preset.color,
          description: '',
        });
        added++;
      }
    });
  });
  saveEvents();
  closeQuickModal();
  render();
}

/* ─── Event Wiring ───────────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', async () => {

  // View switcher
  document.querySelectorAll('.view-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.view = btn.dataset.view;
      // Normalise cursor for month view
      if (state.view === 'month') {
        state.cursor = new Date(state.cursor.getFullYear(), state.cursor.getMonth(), 1);
      }
      render();
    });
  });

  // Nav arrows
  document.getElementById('btnPrev').addEventListener('click', () => navigate(-1));
  document.getElementById('btnNext').addEventListener('click', () => navigate(1));
  document.getElementById('btnToday').addEventListener('click', () => {
    state.cursor = new Date(state.today);
    if (state.view === 'month') {
      state.cursor = new Date(state.today.getFullYear(), state.today.getMonth(), 1);
    }
    render();  // week / twoweek: cursor = today, startOfWeek is computed in render
  });

  // Create button
  document.getElementById('btnCreate').addEventListener('click', () => openModal(null));

  // Quick entry button & modal
  document.getElementById('btnQuickEntry').addEventListener('click', openQuickModal);
  document.getElementById('quickClose').addEventListener('click', closeQuickModal);
  document.getElementById('quickCancel').addEventListener('click', closeQuickModal);
  document.getElementById('quickSave').addEventListener('click', saveQuickEntries);
  document.getElementById('quickOverlay').addEventListener('click', e => {
    if (e.target === document.getElementById('quickOverlay')) closeQuickModal();
  });

  // Week navigation in quick modal
  document.getElementById('quickWeekPrev').addEventListener('click', () => {
    quickState.weekStart = addDays(quickState.weekStart, -7);
    quickState.selected.p1.clear();
    quickState.selected.p2.clear();
    selectAllWeekdays();
    renderQuickModal();
  });
  document.getElementById('quickWeekNext').addEventListener('click', () => {
    quickState.weekStart = addDays(quickState.weekStart, 7);
    quickState.selected.p1.clear();
    quickState.selected.p2.clear();
    selectAllWeekdays();
    renderQuickModal();
  });

  // Preset toggle (radio selection)
  document.querySelectorAll('.quick-preset-toggle').forEach(toggle => {
    toggle.addEventListener('click', () => {
      const presetId = toggle.dataset.preset === '1' ? 'p1' : 'p2';
      setActivePreset(presetId);
      // Pre-select all weekdays for the newly activated preset
      if (quickState.selected[presetId].size === 0) {
        for (let i = 0; i < 5; i++) quickState.selected[presetId].add(i);
      }
      renderQuickModal();
    });
  });

  // Alle / Keine buttons
  document.querySelectorAll('.quick-sel-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const presetId = btn.dataset.preset === '1' ? 'p1' : 'p2';
      if (btn.dataset.action === 'all') {
        for (let i = 0; i < 5; i++) quickState.selected[presetId].add(i);
      } else {
        quickState.selected[presetId].clear();
      }
      renderQuickModal();
    });
  });

  // Modal buttons
  document.getElementById('modalClose').addEventListener('click', closeModal);
  document.getElementById('btnCancel').addEventListener('click', closeModal);
  document.getElementById('btnSave').addEventListener('click', saveEvent);
  document.getElementById('btnDeleteEvt').addEventListener('click', () => {
    if (state.editId) deleteEvent(state.editId);
  });

  // Close modal on overlay click
  document.getElementById('modalOverlay').addEventListener('click', e => {
    if (e.target === document.getElementById('modalOverlay')) closeModal();
  });

  // Custom priority dropdown
  document.getElementById('prioTrigger').addEventListener('click', () => {
    document.getElementById('prioMenu').classList.toggle('open');
  });
  document.getElementById('prioMenu').addEventListener('click', e => {
    const opt = e.target.closest('.prio-option');
    if (!opt) return;
    document.getElementById('evtPriority').value = opt.dataset.value;
    document.getElementById('prioMenu').classList.remove('open');
    syncPriorityColor();
  });
  // Close dropdown on outside click
  document.addEventListener('click', e => {
    if (!e.target.closest('#prioDropdown')) {
      document.getElementById('prioMenu').classList.remove('open');
    }
  });

  // Sync quick buttons when user types a time manually
  document.getElementById('evtStart').addEventListener('change', () => syncTimeQuick('evtStart'));
  document.getElementById('evtEnd').addEventListener('change', () => syncTimeQuick('evtEnd'));

  // Time quick-select buttons
  document.querySelectorAll('.time-quick').forEach(btn => {
    btn.addEventListener('click', () => {
      const input = document.getElementById(btn.dataset.target);
      input.value = btn.dataset.value;
      // Highlight active button within the same group
      btn.closest('.time-quick-btns').querySelectorAll('.time-quick').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  // Color swatches
  document.getElementById('colorSwatches').addEventListener('click', e => {
    const sw = e.target.closest('.swatch');
    if (sw) setColor(sw.dataset.color);
  });
  document.getElementById('evtColor').addEventListener('input', e => {
    state.selectedColor = e.target.value;
    document.querySelectorAll('.swatch').forEach(s => s.classList.remove('active'));
  });

  // Filter checkboxes
  document.querySelectorAll('.filter-item input').forEach(cb => {
    cb.addEventListener('change', () => {
      if (cb.checked) state.activeFilters.add(cb.value);
      else state.activeFilters.delete(cb.value);
      render();
    });
  });

  // Mini cal navigation
  document.getElementById('miniPrev').addEventListener('click', () => {
    state.miniCursor = new Date(state.miniCursor.getFullYear(), state.miniCursor.getMonth() - 1, 1);
    renderMiniCal();
  });
  document.getElementById('miniNext').addEventListener('click', () => {
    state.miniCursor = new Date(state.miniCursor.getFullYear(), state.miniCursor.getMonth() + 1, 1);
    renderMiniCal();
  });

  // Popup buttons
  document.getElementById('popupClose').addEventListener('click', hidePopup);
  document.getElementById('popupEdit').addEventListener('click', () => {
    const id = document.getElementById('eventPopup').dataset.evId;
    hidePopup();
    openModal(id);
  });
  document.getElementById('popupDelete').addEventListener('click', () => {
    const id = document.getElementById('eventPopup').dataset.evId;
    if (id) deleteEvent(id);
  });

  // Close popup on outside click
  document.addEventListener('click', e => {
    const popup = document.getElementById('eventPopup');
    if (popup.classList.contains('show') && !popup.contains(e.target) && !e.target.closest('.event-pill,.event-block')) {
      hidePopup();
    }
  });

  // Keyboard: Escape closes modal/popup
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      closeModal();
      hidePopup();
    }
    if (e.key === 'Enter' && document.getElementById('modalOverlay').classList.contains('open')) {
      if (document.activeElement.tagName !== 'TEXTAREA') saveEvent();
    }
  });

  // Events vom Server laden, dann rendern
  state.events = await fetchEvents();
  state.cursor = new Date(state.today.getFullYear(), state.today.getMonth(), 1);
  render();

  // ─── Mobile Sidebar Toggle ───────────────────────────────────────────────
  const sidebarEl = document.querySelector('.sidebar');
  const overlayEl = document.getElementById('sidebarOverlay');

  function closeSidebar() {
    sidebarEl.classList.remove('open');
    overlayEl.classList.remove('show');
  }

  document.getElementById('btnMenu').addEventListener('click', () => {
    const isOpen = sidebarEl.classList.toggle('open');
    overlayEl.classList.toggle('show', isOpen);
  });
  overlayEl.addEventListener('click', closeSidebar);
  document.getElementById('btnCreate').addEventListener('click', closeSidebar);
  document.getElementById('btnQuickEntry').addEventListener('click', closeSidebar);
});
