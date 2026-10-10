import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, LayoutChangeEvent, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import * as Location from 'expo-location';
import { AlertCircle, LocateFixed, MapPin } from 'lucide-react-native';
import { colors, radius, spacing, typography } from '../theme';
import { useScrollIntoViewOnFocus } from './KeyboardAwareForm';

type Suggestion = { id: string; label: string };

// Only the Nominatim address parts we read.
type NominatimAddress = {
  house_number?: string;
  road?: string;
  neighbourhood?: string;
  suburb?: string;
  quarter?: string;
  city_district?: string;
  city?: string;
  town?: string;
  village?: string;
};

type NominatimResult = {
  place_id?: number | string;
  display_name: string;
  address?: NominatimAddress;
};

// Short label from structured fields: house number + street + area.
// The area stays on purpose — district guessing matches against this text.
function shortAddressLabel(result: NominatimResult): string {
  const a = result.address;
  if (!a) return result.display_name;

  const parts: string[] = [];
  if (a.house_number) parts.push(a.house_number);
  if (a.road) parts.push(a.road);
  const area = a.neighbourhood || a.suburb || a.quarter || a.city_district;
  if (area) parts.push(area);

  if (parts.length > 0) return parts.join(', ');

  // No street match → the coarsest place name, never the raw string with postcode/country.
  return area || a.city || a.town || a.village || result.display_name;
}

// Collapse whitespace so visually identical rows dedupe (no case in Georgian).
function normalizeForDedup(label: string): string {
  return label.trim().replace(/\s+/g, ' ').toLowerCase();
}

type Props = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  onSelect?: (label: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  error?: string;
  required?: boolean;
  onSubmitEditing?: () => void;
};

const MIN_QUERY_LEN = 3;
const DEBOUNCE_MS = 500;
const BLUR_HIDE_DELAY_MS = 200;

// Address field with Nominatim suggestions (free, no key; 500ms debounce).
// Free text still works — validation is just non-empty.
// ponytail: public Nominatim is ~1 req/s; self-host or a paid geocoder if traffic grows.
export const AddressAutocompleteField = React.forwardRef<TextInput, Props>(function AddressAutocompleteField(
  { label, value, onChangeText, onSelect, onBlur, placeholder, error, required, onSubmitEditing },
  forwardedRef,
) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [showList, setShowList] = useState(false);
  const [fieldHeight, setFieldHeight] = useState(0);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const blurTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestSeq = useRef(0);
  const { ref: scrollRef, onFocus: scrollOnFocus } = useScrollIntoViewOnFocus();

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (blurTimerRef.current) clearTimeout(blurTimerRef.current);
    };
  }, []);

  const search = (query: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length < MIN_QUERY_LEN) {
      setSuggestions([]);
      setLoading(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      const seq = ++requestSeq.current;
      setLoading(true);
      try {
        const url = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=5&countrycodes=ge&accept-language=ka&q=${encodeURIComponent(query)}`;
        const res = await fetch(url, { headers: { 'User-Agent': 'ostato-app (Georgia local services marketplace)' } });
        const data = await res.json();
        if (seq !== requestSeq.current) return;

        const results = Array.isArray(data) ? (data as NominatimResult[]) : [];
        // Dedup by the normalized short label — different OSM results can shorten to the same row.
        const seen = new Set<string>();
        const deduped: Suggestion[] = [];
        results.forEach((item, idx) => {
          const label = shortAddressLabel(item);
          const key = normalizeForDedup(label);
          if (seen.has(key)) return;
          seen.add(key);
          deduped.push({ id: `${item.place_id ?? idx}`, label });
        });
        setSuggestions(deduped);
      } catch {
        if (seq === requestSeq.current) setSuggestions([]);
      } finally {
        if (seq === requestSeq.current) setLoading(false);
      }
    }, DEBOUNCE_MS);
  };

  const handleChangeText = (text: string) => {
    onChangeText(text);
    setShowList(true);
    search(text);
  };

  const handleSelect = (s: Suggestion) => {
    if (blurTimerRef.current) clearTimeout(blurTimerRef.current);
    onChangeText(s.label);
    onSelect?.(s.label);
    setSuggestions([]);
    setShowList(false);
  };

  const handleFocus = () => {
    if (blurTimerRef.current) clearTimeout(blurTimerRef.current);
    if (value.trim().length >= MIN_QUERY_LEN) setShowList(true);
    scrollOnFocus();
  };

  const handleBlur = () => {
    blurTimerRef.current = setTimeout(() => setShowList(false), BLUR_HIDE_DELAY_MS);
    onBlur?.();
  };

  const onFieldLayout = (e: LayoutChangeEvent) => setFieldHeight(e.nativeEvent.layout.height);

  // GPS → Nominatim reverse geocoding → same short label format.
  const handleUseLocation = async () => {
    if (locating) return;
    setLocationError('');
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocationError('მდებარეობაზე წვდომის ნებართვა არ მოგვეცა');
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&addressdetails=1&accept-language=ka&lat=${pos.coords.latitude}&lon=${pos.coords.longitude}`;
      const res = await fetch(url, { headers: { 'User-Agent': 'ostato-app (Georgia local services marketplace)' } });
      const data = (await res.json()) as NominatimResult & { error?: string };
      if (data?.error || !data?.display_name) {
        setLocationError('მისამართი ვერ დადგინდა — შეიყვანე ხელით');
        return;
      }
      const label = shortAddressLabel(data);
      onChangeText(label);
      onSelect?.(label);
      setSuggestions([]);
      setShowList(false);
    } catch {
      setLocationError('მდებარეობის დადგენა ვერ მოხერხდა');
    } finally {
      setLocating(false);
    }
  };

  const dropdownOpen = showList && value.trim().length >= MIN_QUERY_LEN && (loading || suggestions.length > 0);

  return (
    <View style={[styles.wrap, dropdownOpen ? styles.wrapElevated : null]}>
      <View onLayout={onFieldLayout}>
        <Text style={styles.label}>
          {label}
          {required && <Text style={styles.requiredMark}> *</Text>}
        </Text>
        <View style={styles.inputWrapper}>
          <View style={styles.leftIcon}>
            <MapPin size={15} color={colors.mutedForeground} />
          </View>
          <TextInput
            ref={(node) => {
              scrollRef.current = node;
              if (typeof forwardedRef === 'function') forwardedRef(node);
              else if (forwardedRef) (forwardedRef as React.MutableRefObject<TextInput | null>).current = node;
            }}
            value={value}
            onChangeText={handleChangeText}
            onFocus={handleFocus}
            onBlur={handleBlur}
            placeholder={placeholder}
            placeholderTextColor={colors.mutedForeground}
            returnKeyType={onSubmitEditing ? 'next' : undefined}
            onSubmitEditing={onSubmitEditing}
            blurOnSubmit={!onSubmitEditing}
            style={[styles.input, styles.inputWithLeftIcon, loading ? styles.inputWithRightIcon : null, error ? styles.inputError : null]}
          />
          {loading && (
            <View style={styles.rightIcon}>
              <ActivityIndicator size="small" color={colors.primary} />
            </View>
          )}
        </View>
        {error ? (
          <View style={styles.errorRow}>
            <AlertCircle size={11} color={colors.destructive} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}
        <Pressable style={styles.locateRow} onPress={handleUseLocation} disabled={locating}>
          {locating ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <LocateFixed size={14} color={colors.primary} />
          )}
          <Text style={styles.locateText}>{locating ? 'მდებარეობა დგინდება...' : 'ჩემი მდებარეობის გამოყენება'}</Text>
        </Pressable>
        {!!locationError && <Text style={styles.locateErrorText}>{locationError}</Text>}
      </View>

      {dropdownOpen && (
        <View style={[styles.dropdown, { top: fieldHeight + 4 }]}>
          {suggestions.length === 0 ? (
            <View style={styles.dropdownEmpty}>
              {loading ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Text style={styles.dropdownEmptyText}>მისამართი ვერ მოიძებნა — გააგრძელე ტექსტით</Text>
              )}
            </View>
          ) : (
            suggestions.map((s) => (
              <Pressable key={s.id} style={styles.dropdownRow} onPress={() => handleSelect(s)}>
                <MapPin size={14} color={colors.mutedForeground} />
                <Text style={styles.dropdownRowText} numberOfLines={2}>
                  {s.label}
                </Text>
              </Pressable>
            ))
          )}
        </View>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: {
    position: 'relative',
    zIndex: 1,
  },
  wrapElevated: {
    zIndex: 30,
  },
  label: {
    ...typography.captionMedium,
    color: colors.foreground,
    marginBottom: spacing.sm,
  },
  requiredMark: {
    color: colors.destructive,
  },
  inputWrapper: {
    position: 'relative',
    justifyContent: 'center',
  },
  input: {
    ...typography.body,
    color: colors.foreground,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  inputWithLeftIcon: {
    paddingLeft: 40,
  },
  inputWithRightIcon: {
    paddingRight: 44,
  },
  inputError: {
    borderColor: colors.destructive,
  },
  leftIcon: {
    position: 'absolute',
    left: spacing.md,
    zIndex: 1,
  },
  rightIcon: {
    position: 'absolute',
    right: spacing.md,
    padding: spacing.xs,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: spacing.xs,
  },
  errorText: {
    ...typography.small,
    color: colors.destructive,
  },
  locateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: spacing.sm,
    alignSelf: 'flex-start',
  },
  locateText: {
    ...typography.small,
    color: colors.primary,
    fontWeight: '600',
  },
  locateErrorText: {
    ...typography.small,
    color: colors.destructive,
    marginTop: 4,
  },
  dropdown: {
    position: 'absolute',
    left: 0,
    right: 0,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: spacing.xs,
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  dropdownRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
  },
  dropdownRowText: {
    ...typography.small,
    color: colors.foreground,
    flex: 1,
    lineHeight: 17,
  },
  dropdownEmpty: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 4,
    alignItems: 'center',
  },
  dropdownEmptyText: {
    ...typography.small,
    color: colors.mutedForeground,
    textAlign: 'center',
  },
});
