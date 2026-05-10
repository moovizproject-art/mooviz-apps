import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Switch,
  Modal, FlatList, Pressable,
} from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { useI18n } from '../i18n/I18nContext';

interface DatePickerInputProps {
  value: Date | null;
  isAsap: boolean;
  onDateChange: (date: Date | null) => void;
  onAsapToggle: (isAsap: boolean) => void;
  minimumDate?: Date;
  timeRange?: string | null;
  onTimeRangeChange?: (range: string | null) => void;
}

const TIME_RANGE_KEYS = [
  { key: 'morning', labelKey: 'date.morning', hours: '08:00–12:00' },
  { key: 'afternoon', labelKey: 'date.afternoon', hours: '12:00–16:00' },
  { key: 'evening', labelKey: 'date.evening', hours: '16:00–20:00' },
  { key: 'night', labelKey: 'date.night', hours: '20:00–24:00' },
];

/** Generate next 60 days */
function generateDays(minDate: Date): Date[] {
  const days: Date[] = [];
  for (let i = 0; i < 60; i++) {
    const d = new Date(minDate);
    d.setDate(d.getDate() + i);
    d.setHours(0, 0, 0, 0);
    days.push(d);
  }
  return days;
}

function formatDayLabel(date: Date, locale: string): string {
  try {
    return date.toLocaleDateString(locale === 'en' ? 'en-US' : 'he-IL', {
      weekday: 'long', day: 'numeric', month: 'long',
    });
  } catch {
    return date.toLocaleDateString();
  }
}

function formatDateShort(date: Date, locale: string): string {
  try {
    return date.toLocaleDateString(locale === 'en' ? 'en-US' : 'he-IL', {
      weekday: 'short', day: 'numeric', month: 'short',
    });
  } catch {
    return date.toLocaleDateString();
  }
}

export function DatePickerInput({ value, isAsap, onDateChange, onAsapToggle, minimumDate, timeRange, onTimeRangeChange }: DatePickerInputProps): React.JSX.Element {
  const [modalVisible, setModalVisible] = useState(false);
  const [tempDate, setTempDate] = useState<Date | null>(null);
  const { colors } = useTheme();
  const { t, locale } = useI18n();
  const minDate = minimumDate || new Date();

  const days = React.useMemo(() => generateDays(minDate), [minDate.toDateString()]);

  const openPicker = () => {
    setTempDate(value || new Date());
    setModalVisible(true);
  };

  const handleConfirm = () => {
    if (!tempDate) return;
    onDateChange(tempDate);
    setModalVisible(false);
  };

  return (
    <View style={styles.container}>
      {/* Header: label + ASAP toggle */}
      <View style={styles.asapRow}>
        <Text style={[styles.label, styles.labelFlex, { color: colors.textPrimary }]} numberOfLines={1}>
          {t('form.pickupDate')} *
        </Text>
        <View style={styles.asapToggle}>
          <Text style={[styles.asapLabel, { color: colors.textSecondary }]} numberOfLines={1}>
            {t('form.asap')}
          </Text>
          <Switch
            value={isAsap}
            onValueChange={(val) => {
              onAsapToggle(val);
              if (val) {
                onDateChange(null);
                onTimeRangeChange?.(null);
              }
            }}
            trackColor={{ true: colors.primary }}
          />
        </View>
      </View>

      {/* Hint: explain toggle */}
      <Text style={[styles.scheduleHint, { color: colors.textTertiary }]}>
        {isAsap
          ? t('form.asapHint')
          : t('form.scheduledHint')}
      </Text>

      {!isAsap && (
        <>
          {/* Date picker button */}
          <TouchableOpacity
            style={[styles.pickerButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={openPicker}
          >
            <Text style={[styles.pickerText, { color: value ? colors.textPrimary : colors.textSecondary }]}>
              {value ? formatDateShort(value, locale) : t('form.selectDate')}
            </Text>
            <Text style={styles.icon}>📅</Text>
          </TouchableOpacity>

          {/* Time range chips */}
          <Text style={[styles.rangeLabel, { color: colors.textPrimary }]}>
            {t('form.pickupTime')}
          </Text>
          <View style={styles.rangeRow}>
            {TIME_RANGE_KEYS.map((range) => {
              const isSelected = timeRange === range.key;
              return (
                <TouchableOpacity
                  key={range.key}
                  style={[
                    styles.rangeChip,
                    {
                      backgroundColor: isSelected ? colors.primary : colors.surface,
                      borderColor: isSelected ? colors.primary : colors.border,
                    },
                  ]}
                  onPress={() => onTimeRangeChange?.(isSelected ? null : range.key)}
                >
                  <Text style={[styles.rangeChipLabel, { color: isSelected ? '#FFFFFF' : colors.textPrimary }]}>
                    {t(range.labelKey)}
                  </Text>
                  <Text style={[styles.rangeChipHours, { color: isSelected ? 'rgba(255,255,255,0.8)' : colors.textSecondary }]}>
                    {range.hours}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </>
      )}

      {/* Date Picker Modal (date only, no time) */}
      <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={() => setModalVisible(false)}>
        <Pressable style={styles.overlay} onPress={() => setModalVisible(false)}>
          <Pressable style={[styles.sheet, { backgroundColor: colors.background }]} onPress={() => {}}>
            <View style={[styles.sheetHeader, { borderBottomColor: colors.border }]}>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Text style={[styles.headerBtn, { color: colors.textSecondary }]}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>{t('form.pickupDate')}</Text>
              <TouchableOpacity onPress={handleConfirm}>
                <Text style={[styles.headerBtn, { color: colors.primary, fontWeight: '700' }]}>{t('common.confirm')}</Text>
              </TouchableOpacity>
            </View>

            <FlatList
              data={days}
              keyExtractor={(d) => d.toISOString()}
              style={styles.dayList}
              renderItem={({ item }) => {
                const isSelected = tempDate?.toDateString() === item.toDateString();
                return (
                  <TouchableOpacity
                    style={[styles.dayRow, isSelected && { backgroundColor: colors.primary + '18' }]}
                    onPress={() => setTempDate(item)}
                  >
                    <View style={[styles.dayDot, isSelected && { backgroundColor: colors.primary }]} />
                    <Text style={[styles.dayText, { color: colors.textPrimary }, isSelected && { color: colors.primary, fontWeight: '700' }]}>
                      {formatDayLabel(item, locale)}
                    </Text>
                    {isSelected && <Text style={{ color: colors.primary, fontSize: 16 }}>✓</Text>}
                  </TouchableOpacity>
                );
              }}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: 16 },
  scheduleHint: { fontSize: 12, marginBottom: 8 },
  asapRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, gap: 8 },
  asapToggle: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 0 },
  label: { fontSize: 14, fontWeight: '600' },
  labelFlex: { flexShrink: 1 },
  asapLabel: { fontSize: 13 },
  pickerButton: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14, borderRadius: 12, borderWidth: 1,
  },
  pickerText: { fontSize: 15 },
  icon: { fontSize: 18 },
  // Time range chips
  rangeLabel: { fontSize: 13, fontWeight: '600', marginTop: 12, marginBottom: 8 },
  rangeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  rangeChip: {
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, borderWidth: 1,
    alignItems: 'center', minWidth: 75,
  },
  rangeChipLabel: { fontSize: 13, fontWeight: '700' },
  rangeChipHours: { fontSize: 11, marginTop: 2 },
  // Modal
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '60%', overflow: 'hidden' },
  sheetHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1,
  },
  headerBtn: { fontSize: 15 },
  headerTitle: { fontSize: 17, fontWeight: '700' },
  dayList: { maxHeight: 400 },
  dayRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 20, paddingVertical: 14,
  },
  dayDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#DDD' },
  dayText: { flex: 1, fontSize: 15 },
});
