import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, Switch } from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useTheme } from '../theme/ThemeContext';
import { useI18n } from '../i18n/I18nContext';
import { formatDate } from '../utils/formatters';

interface DatePickerInputProps {
  value: Date | null;
  isAsap: boolean;
  onDateChange: (date: Date | null) => void;
  onAsapToggle: (isAsap: boolean) => void;
  minimumDate?: Date;
}

export function DatePickerInput({ value, isAsap, onDateChange, onAsapToggle, minimumDate }: DatePickerInputProps): React.JSX.Element {
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
              if (val) onDateChange(null);
            }}
            trackColor={{ true: colors.primary }}
          />
        </View>
      </View>
      {!isAsap && (
        <TouchableOpacity
          style={[styles.pickerButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onPress={() => setShowPicker(true)}
        >
          <Text style={[styles.pickerText, { color: value ? colors.textPrimary : colors.textSecondary }]}>
            {value ? formatDate(value) : t('form.selectDate')}
          </Text>
          <Text style={styles.icon}>📅</Text>
        </TouchableOpacity>
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
});
