import React, { useCallback, useEffect, useState } from 'react';
import { AppState, Linking, StyleSheet, Text, View } from 'react-native';
import Constants from 'expo-constants';
import { Button } from './Button';
import { fetchAppGate, type AppGate } from '../services/appGateService';
import { compareVersions } from '../utils/compareVersions';
import { colors, spacing, typography } from '../theme';

const CURRENT_VERSION = Constants.expoConfig?.version ?? '0.0.0';

// ტექნიკური რეჟიმი ან მოძველებული ვერსია: სრულეკრანიანი გადასაფარებელი ყველაფერზე (children-ს არ ვაუქმებთ,
// რომ ნავიგაციის მდგომარეობა არ დაიკარგოს, როცა ბლოკი მოიხსნება). ბლოკი მოწმდება გაშვებისას და ფონიდან დაბრუნებისას.
export function AppGateOverlay() {
  const [gate, setGate] = useState<AppGate | null>(null);

  const check = useCallback(async () => {
    setGate(await fetchAppGate());
  }, []);

  useEffect(() => {
    check();
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') check();
    });
    return () => sub.remove();
  }, [check]);

  if (!gate) return null;
  const outdated = !!gate.minVersion && compareVersions(CURRENT_VERSION, gate.minVersion) < 0;
  if (!gate.maintenance && !outdated) return null;

  return (
    <View style={styles.overlay} testID="app-gate-overlay">
      <Text style={styles.emoji}>{gate.maintenance ? '🛠️' : '⬆️'}</Text>
      <Text style={styles.title}>{gate.maintenance ? 'მიმდინარეობს ტექნიკური სამუშაოები' : 'საჭიროა აპის განახლება'}</Text>
      <Text style={styles.body}>
        {gate.maintenance
          ? gate.message || 'აპი დროებით მიუწვდომელია. გთხოვთ, სცადოთ მოგვიანებით.'
          : 'ამ ვერსიით აპი აღარ მუშაობს. გთხოვთ, განაახლოთ უახლეს ვერსიამდე.'}
      </Text>
      {!gate.maintenance && !!gate.updateUrl && (
        <Button label="განახლება" onPress={() => Linking.openURL(gate.updateUrl).catch(() => {})} />
      )}
      {gate.maintenance && <Button label="ხელახლა შემოწმება" variant="outline" onPress={check} />}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1000,
    elevation: 1000,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.md,
  },
  emoji: { fontSize: 48 },
  title: { ...typography.h2, color: colors.foreground, textAlign: 'center' },
  body: { ...typography.body, color: colors.mutedForeground, textAlign: 'center', marginBottom: spacing.md },
});
