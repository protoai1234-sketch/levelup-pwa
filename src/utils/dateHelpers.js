export function todayString() {
  return localDateStr(new Date());
}

export function localDateStr(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function parseDate(dateStr) {
  return new Date(dateStr + 'T12:00:00');
}

export function getDatesInRange(startStr, endStr) {
  const dates = [];
  const cur = parseDate(startStr);
  const end = parseDate(endStr);
  while (cur <= end) {
    dates.push(localDateStr(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
}

export function isActiveDay(dateStr, activeDays) {
  return activeDays.includes(parseDate(dateStr).getDay());
}

export function isVacationDay(dateStr, vacationDays) {
  return vacationDays.includes(dateStr);
}

export function formatDateFull(dateStr) {
  return parseDate(dateStr).toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
  });
}

export function formatDateMedium(dateStr) {
  return parseDate(dateStr).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

export function formatDateShort(dateStr) {
  return parseDate(dateStr).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric',
  });
}

export function getWeekDates(refDateStr) {
  const d = parseDate(refDateStr);
  const jsDay = d.getDay();
  const daysFromMonday = (jsDay + 6) % 7;
  const monday = new Date(d);
  monday.setDate(d.getDate() - daysFromMonday);
  const labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  return labels.map((label, i) => {
    const day = new Date(monday);
    day.setDate(monday.getDate() + i);
    return { date: localDateStr(day), label };
  });
}

export function addDays(dateStr, n) {
  const d = parseDate(dateStr);
  d.setDate(d.getDate() + n);
  return localDateStr(d);
}

export function formatTime(timeStr) {
  if (!timeStr) return '';
  const [h, m] = timeStr.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return `${hour}:${m.toString().padStart(2, '0')} ${ampm}`;
}

export function timeFromDate(date) {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

export function timeStrToDate(timeStr) {
  const [h, m] = timeStr.split(':').map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d;
}
