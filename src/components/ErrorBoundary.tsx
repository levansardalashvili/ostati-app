import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from './Button';
import { colors, spacing, typography } from '../theme';
import { reportError } from '../services/errorReporter';

// Catches render errors anywhere below it: reports them (0154) and shows a
// friendly retry screen instead of a blank/red app.
export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown, info: React.ErrorInfo) {
    reportError(error, { fatal: true, context: `render${info.componentStack ? `:${info.componentStack.slice(0, 150)}` : ''}` });
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <View style={styles.wrap}>
        <Text style={styles.title}>რაღაც შეცდომა მოხდა</Text>
        <Text style={styles.text}>შეცდომის შესახებ ინფორმაცია უკვე გაიგზავნა. სცადეთ თავიდან.</Text>
        <Button label="თავიდან ცდა" onPress={() => this.setState({ failed: false })} />
      </View>
    );
  }
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.md,
    backgroundColor: colors.background,
  },
  title: {
    ...typography.h2,
    color: colors.foreground,
    textAlign: 'center',
  },
  text: {
    ...typography.body,
    color: colors.mutedForeground,
    textAlign: 'center',
  },
});
