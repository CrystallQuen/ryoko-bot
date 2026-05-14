import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface CalendarPickerProps {
  value: Date | null;
  onChange: (date: Date) => void;
}

const MONTHS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
const DAYS = ['Di', 'Lu', 'Ma', 'Me', 'Je', 'Ve', 'Sa'];

export default function CalendarPicker({ value, onChange }: CalendarPickerProps) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [viewYear, setViewYear] = useState(value?.getFullYear() ?? today.getFullYear());
  const [viewMonth, setViewMonth] = useState(value?.getMonth() ?? today.getMonth());
  const [hour, setHour] = useState(value?.getHours() ?? 20);
  const [minute, setMinute] = useState(value?.getMinutes() ?? 0);

  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  };

  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  };

  const selectDay = (day: number) => {
    const d = new Date(viewYear, viewMonth, day, hour, minute);
    onChange(d);
  };

  const updateTime = (newHour: number, newMinute: number) => {
    setHour(newHour);
    setMinute(newMinute);
    if (value) {
      const d = new Date(value);
      d.setHours(newHour, newMinute);
      onChange(d);
    }
  };

  const isSelected = (day: number) =>
    value?.getFullYear() === viewYear &&
    value?.getMonth() === viewMonth &&
    value?.getDate() === day;

  const isPast = (day: number) => new Date(viewYear, viewMonth, day) < today;

  const cells: (number | null)[] = Array(firstDay).fill(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div className="bg-[#1e1f22] border border-white/10 rounded-xl p-4 select-none">
      {/* Header mois/année */}
      <div className="flex items-center justify-between mb-4">
        <button onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-white font-semibold text-sm uppercase tracking-wide">
          {MONTHS[viewMonth]} {viewYear}
        </span>
        <button onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors">
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Grille jours */}
      <div className="grid grid-cols-7 gap-0.5 mb-3">
        {DAYS.map(d => (
          <div key={d} className="text-center text-xs text-gray-500 font-medium py-1">{d}</div>
        ))}
        {cells.map((day, i) => {
          if (!day) return <div key={i} />;
          const past = isPast(day);
          const selected = isSelected(day);
          return (
            <button
              key={i}
              disabled={past}
              onClick={() => selectDay(day)}
              className={[
                'w-full aspect-square rounded-lg text-sm font-medium transition-colors flex items-center justify-center',
                past ? 'text-gray-600 cursor-not-allowed' :
                selected ? 'bg-discord-blurple text-white' :
                'text-gray-300 hover:bg-white/10 hover:text-white',
              ].join(' ')}
            >
              {day}
            </button>
          );
        })}
      </div>

      {/* Sélecteur heure */}
      <div className="border-t border-white/10 pt-3 mt-1">
        <p className="text-xs text-gray-500 mb-2 uppercase tracking-wide font-medium">Heure</p>
        <div className="flex items-center gap-2">
          <select
            value={hour}
            onChange={e => updateTime(parseInt(e.target.value), minute)}
            className="flex-1 bg-[#2b2d31] border border-white/10 rounded-lg text-white text-sm px-2 py-1.5 focus:outline-none focus:border-discord-blurple"
          >
            {Array.from({ length: 24 }, (_, h) => (
              <option key={h} value={h}>{String(h).padStart(2, '0')}h</option>
            ))}
          </select>
          <span className="text-gray-500 font-bold">:</span>
          <select
            value={minute}
            onChange={e => updateTime(hour, parseInt(e.target.value))}
            className="flex-1 bg-[#2b2d31] border border-white/10 rounded-lg text-white text-sm px-2 py-1.5 focus:outline-none focus:border-discord-blurple"
          >
            {[0, 15, 30, 45].map(m => (
              <option key={m} value={m}>{String(m).padStart(2, '0')}</option>
            ))}
          </select>
        </div>
        {value && (
          <p className="text-xs text-discord-blurple mt-2 text-center font-medium">
            {value.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} à {String(hour).padStart(2, '0')}:{String(minute).padStart(2, '0')}
          </p>
        )}
      </div>
    </div>
  );
}
