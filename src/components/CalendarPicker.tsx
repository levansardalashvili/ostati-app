import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { colors, radius, spacing, typography } from '../theme';

const MONTH_NAMES = [
  'იანვარი', 'თებერვალი', 'მარტი', 'აპრილი', 'მაისი', 'ივნისი',
  'ივლისი', 'აგვისტო', 'სექტემბერი', 'ოქტომბერი', 'ნოემბერი', 'დეკემბერი',
];
const MONTH_SHORT = ['იან', 'თებ', 'მარ', 'აპრ', 'მაი', 'ივნ', 'ივლ', 'აგვ', 'სექ', 'ოქტ', 'ნოე', 'დეკ'];
const WEEKDAY_LABELS = ['ორ', 'სა', 'ოთ', 'ხუ', 'პა', 'შა', 'კვ']; // ორშაბათი..კვირა

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

// "YYYY-MM-DD" — კანონიკური, timezone-უსაფრთხო ფორმატი (supabase/migrations/
// 0041-ის `preferred_date`-ისთვის). ლოკალური calendar-ველებით (getFullYear/
// getMonth/getDate), არა `.toISOString()`-ით — ეს უკანასკნელი UTC-ზე
// გარდაქმნის თარიღს და შუაღამესთან ახლოს შეიძლება თარიღი გადაწიოს
// მოწყობილობის timezone-ის მიხედვით.
export function toIsoDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// "დღეს"/"ხვალ" ან "D თვე" ფორმატში — job-ის თარიღების არსებული
// ჩვენების კონვენციასთან თანხვედრით (მაგ. "20 დეკ.").
export function formatPickedDate(date: Date): string {
  const today = startOfDay(new Date());
  const target = startOfDay(date);
  const diffDays = Math.round((target.getTime() - today.getTime()) / 86400000);
  if (diffDays === 0) return 'დღეს';
  if (diffDays === 1) return 'ხვალ';
  return `${date.getDate()} ${MONTH_SHORT[date.getMonth()]}`;
}

type Props = {
  selected: Date | null;
  onSelect: (date: Date) => void;
  minDate?: Date;
};

// CalendarPicker — თვის ბადის კალენდარი (pure RN, ბუნებრივი date-picker
// ბიბლიოთეკის გარეშე — native module-ის დამატება dev client-ის ხელახლა
// აწყობას მოითხოვდა). წარსული დღეები disabled-ია.
export function CalendarPicker({ selected, onSelect, minDate }: Props) {
  const today = startOfDay(new Date());
  const floor = minDate ? startOfDay(minDate) : today;
  const [viewDate, setViewDate] = useState(() => selected ?? today);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstOfMonth = new Date(year, month, 1);
  const firstWeekday = (firstOfMonth.getDay() + 6) % 7; // 0=ორშ .. 6=კვ
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells: (number | null)[] = [
    ...Array(firstWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  return (
    <View>
      <View style={styles.header}>
        <Pressable style={styles.navButton} onPress={() => setViewDate(new Date(year, month - 1, 1))} hitSlop={8}>
          <ChevronLeft size={18} color={colors.foreground} />
        </Pressable>
        <Text style={styles.headerTitle}>
          {MONTH_NAMES[month]} {year}
        </Text>
        <Pressable style={styles.navButton} onPress={() => setViewDate(new Date(year, month + 1, 1))} hitSlop={8}>
          <ChevronRight size={18} color={colors.foreground} />
        </Pressable>
      </View>

      <View style={styles.weekdayRow}>
        {WEEKDAY_LABELS.map((w) => (
          <Text key={w} style={styles.weekdayText}>
            {w}
          </Text>
        ))}
      </View>

      <View style={styles.grid}>
        {cells.map((day, i) => {
          if (day === null) return <View key={`empty-${i}`} style={styles.cell} />;
          const cellDate = new Date(year, month, day);
          const disabled = cellDate < floor;
          const isSelected = !!selected && isSameDay(cellDate, selected);
          const isToday = isSameDay(cellDate, today);
          return (
            <View key={day} style={styles.cell}>
              <Pressable
                style={[styles.dayCell, isSelected && styles.dayCellSelected]}
                disabled={disabled}
                onPress={() => onSelect(cellDate)}
              >
                <Text
                  style={[
                    styles.dayText,
                    disabled && styles.dayTextDisabled,
                    isToday && !isSelected && styles.dayTextToday,
                    isSelected && styles.dayTextSelected,
                  ]}
                >
                  {day}
                </Text>
              </Pressable>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  navButton: {
    width: 32,
    height: 32,
    borderRadius: radius.full,
    backgroundColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    ...typography.captionMedium,
    color: colors.foreground,
    fontWeight: '700',
  },
  weekdayRow: {
    flexDirection: 'row',
    marginBottom: spacing.xs,
  },
  weekdayText: {
    width: `${100 / 7}%`,
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '700',
    color: colors.mutedForeground,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  cell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCell: {
    width: 34,
    height: 34,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCellSelected: {
    backgroundColor: colors.primary,
  },
  dayText: {
    ...typography.caption,
    color: colors.foreground,
    fontWeight: '600',
  },
  dayTextDisabled: {
    color: colors.border,
  },
  dayTextToday: {
    color: colors.primary,
  },
  dayTextSelected: {
    color: colors.primaryForeground,
  },
});
