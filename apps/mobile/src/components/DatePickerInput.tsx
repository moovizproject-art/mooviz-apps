import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, Switch, ScrollView } from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useTheme } from '../theme/ThemeContext';
import { useI18n } from '../i18n/I18nContext';
import { formatDate } from '../utils/formatters';

const TIME_RANGES = [
  '08:00-10:00', '10:00-12:00', '12:00-14:00',
  '14:00-16:00', '16:00-18:00', '18:00-20:00', '20:00-22:00',
];

interface DatePickerInputProps {
  value: Date | null;
  isAsap: boolean;
  onDateChange: (date: Date | null) => void;
  onAsapToggle: (isAsap: boolean) => void;
  minimumDate?: Date;
  timeRange?: string | null;
  onTimeRangeChange?: (range: string | null) => void;
}

export function DatePickerInput({ value, isAsap, onDateChange, onAsapToggle, minimumDate, timeRange, onTimeRangeChange }: DatePickerInputProps): React.JSX.Element {
  const [showPicker, setShowPicker] = useState(false);
  const { colors } = useTheme();
  const { t } = useI18n();
  const minDate = minimumDate || new Date();

  const handleChange = (_event: DateTimePickerEvent, selectedDate?: Date) => {
    if (Platform.OS === 'android') setShowPicker(false);
    if (selectedDate) onDateChange(selectedDate);
  };

  return (
    <View style={styles.container}>
      <View style={styles.asapRow}>
        <Text style={[styles.label, { color: colors.textPrimary }]}>
          {t('form.pickupDate')} *
        </Text>
        <View style={styles.asapToggle}>
          <Text style={[styles.asapLabel, { color: colors.textSecondary }]}>
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
      {!isAsap && (
        <>
          <TouchableOpacity
            style={[styles.pickerButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => setShowPicker(true)}
          >
            <Text style={[styles.pickerText, { color: value ? colors.textPrimary : colors.textSecondary }]}>
              {value ? formatDate(value) : t('form.selectDate')}
            </Text>
            <Text style={styles.icon}>📅</Text>
          </TouchableOpacity>
          {onTimeRangeChange && (
            <View style={styles.timeSection}>
              <Text style={[styles.timeLabel, { color: colors.textPrimary }]}>
                {t('form.pickupTime')}
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.timeChipRow}>
                {TIME_RANGES.map((range) => (
                  <TouchableOpacity
                    key={range}
                    style={[
                      styles.timeChip,
                      { borderColor: colors.border, backgroundColor: colors.surface },
                      timeRange === range && { backgroundColor: colors.primary, borderColor: colors.primary },
                    ]}
                    onPress={() => onTimeRangeChange(timeRange === range ? null : range)}
                  >
                    <Text style={[
                      styles.timeChipText,
                      { color: colors.textPrimary },
                      timeRange === range && { color: '#FFFFFF' },
                    ]}>
                      {range}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}
        </>
      )}
      {showPicker && (
        <DateTimePicker
          value={value || minDate}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          minimumDate={minDate}
          onChange={handleChange}
          locale="he-IL"
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: 16 },
  asapRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  asapToggle: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  label: { fontSize: 14, fontWeight: '600' },
  asapLabel: { fontSize: 13 },
  pickerButton: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14, borderRadius: 12, borderWidth: 1,
  },
  pickerText: { fontSize: 15 },
  icon: { fontSize: 18 },
  timeSection: { marginTop: 12 },
  timeLabel: { fontSize: 13, fontWeight: '600', marginBottom: 8 },
  timeChipRow: { flexDirection: 'row' },
  timeChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    marginEnd: 8,
  },
  timeChipText: { fontSize: 13, fontWeight: '600' },
});
