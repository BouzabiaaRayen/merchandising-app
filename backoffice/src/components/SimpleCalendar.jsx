import React, { useMemo, useState } from 'react';
import './SimpleCalendar.css';

function getMonthDays(year, month) {
  const lastDay = new Date(year, month + 1, 0);
  const days = [];
  for (let d = 1; d <= lastDay.getDate(); d++) {
    days.push(new Date(year, month, d));
  }
  return days;
}

function toDateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

const MERCH_COLORS = [
  { bg: '#dbeafe', border: '#93c5fd', text: '#1d4ed8' },
  { bg: '#dcfce7', border: '#86efac', text: '#166534' },
  { bg: '#ffedd5', border: '#fdba74', text: '#c2410c' },
  { bg: '#fee2e2', border: '#fca5a5', text: '#b91c1c' },
  { bg: '#f3e8ff', border: '#d8b4fe', text: '#7e22ce' },
  { bg: '#fae8ff', border: '#f0abfc', text: '#a21caf' },
  { bg: '#e0f2fe', border: '#7dd3fc', text: '#0369a1' },
  { bg: '#ecfccb', border: '#bef264', text: '#4d7c0f' },
];

const getColorForMerchandiser = (merchandiserId) => {
  const idNum = Number(merchandiserId);
  const index = Number.isFinite(idNum)
    ? Math.abs(idNum) % MERCH_COLORS.length
    : String(merchandiserId || '').length % MERCH_COLORS.length;
  return MERCH_COLORS[index];
};

export default function SimpleCalendar({ visits, merchandisers, stores }) {
  const today = new Date();
  const [visibleDate, setVisibleDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const year = visibleDate.getFullYear();
  const month = visibleDate.getMonth();
  const days = useMemo(() => getMonthDays(year, month), [year, month]);
  const firstDayOfWeek = new Date(year, month, 1).getDay();
  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const merchNameById = useMemo(() => {
    const map = new Map();
    merchandisers.forEach((m) => map.set(m.id, `${m.first_name || ''} ${m.last_name || ''}`.trim()));
    return map;
  }, [merchandisers]);

  const storeNameById = useMemo(() => {
    const map = new Map();
    stores.forEach((s) => map.set(s.id, s.name || `Store #${s.id}`));
    return map;
  }, [stores]);

  const visitMap = useMemo(() => {
    const grouped = {};
    visits.forEach((visit) => {
      if (!visit.scheduled_date) return;
      const date = new Date(visit.scheduled_date);
      if (Number.isNaN(date.getTime())) return;
      const key = toDateKey(date);
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(visit);
    });
    return grouped;
  }, [visits]);

  const totalMonthVisits = useMemo(
    () => days.reduce((acc, day) => acc + (visitMap[toDateKey(day)]?.length || 0), 0),
    [days, visitMap]
  );

  const goToPreviousMonth = () => setVisibleDate(new Date(year, month - 1, 1));
  const goToNextMonth = () => setVisibleDate(new Date(year, month + 1, 1));

  return (
    <div className="simple-calendar">
      <div className="calendar-header">
        <div className="calendar-heading-row">
          <button className="calendar-nav-btn" onClick={goToPreviousMonth} aria-label="Previous month">‹</button>
          <div>
            <span className="calendar-title">{visibleDate.toLocaleString('default', { month: 'long', year: 'numeric' })}</span>
            <p className="calendar-subtitle">{totalMonthVisits} scheduled visit{totalMonthVisits === 1 ? '' : 's'}</p>
          </div>
          <button className="calendar-nav-btn" onClick={goToNextMonth} aria-label="Next month">›</button>
        </div>
      </div>
      <div className="calendar-weekdays">
        {weekDays.map((wd) => <span key={wd} className="calendar-weekday">{wd}</span>)}
      </div>
      <div className="calendar-grid">
        {Array.from({ length: firstDayOfWeek }).map((_, i) => (
          <div key={'empty-' + i} className="calendar-cell empty" />
        ))}
        {days.map((date) => {
          const key = toDateKey(date);
          const dayVisits = visitMap[key] || [];
          const isToday = key === toDateKey(today);
          return (
            <div key={key} className={`calendar-cell ${isToday ? 'today' : ''}`}>
              <div className="calendar-date">{date.getDate()}</div>
              {dayVisits.map((v, idx) => {
                const merchName = v.merchandiser_name || merchNameById.get(v.merchandiser) || 'Unknown merchandiser';
                const storeName = v.store_name || storeNameById.get(v.store) || 'Store';
                const merchColor = getColorForMerchandiser(v.merchandiser);
                return (
                  <div
                    key={v.id || `${key}-${idx}`}
                    className="calendar-visit"
                    style={{
                      '--visit-bg': merchColor.bg,
                      '--visit-border': merchColor.border,
                      '--visit-text': merchColor.text,
                    }}
                  >
                    <span className="calendar-visit-merch">{merchName}</span>
                    <span className="calendar-visit-store">{storeName}</span>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
