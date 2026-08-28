import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, LayoutChangeEvent, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { AlertCircle, MapPin } from 'lucide-react-native';
import { colors, radius, spacing, typography } from '../theme';

type Suggestion = { id: string; label: string };

type Props = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  onSelect?: (label: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  error?: string;
};

const MIN_QUERY_LEN = 3;
const DEBOUNCE_MS = 500;
const BLUR_HIDE_DELAY_MS = 200;

// მისამართის ველი რუკის შედეგების სიით (OpenStreetMap Nominatim, უფასო,
// API key არ სჭირდება — მომხმარებლის მოთხოვნით). მომხმარებელი წერს
// მისამართს (მაგ. "ჭავჭავაძის 48"), 500ms დებაუნსით მოდის რამდენიმე
// შესატყვისი შედეგი ჩამონათვალის სახით ველის ქვემოთ, არჩევისას ველი
// ივსება არჩეული ვარიანტით. თუ API-მ ვერაფერი იპოვა ან ხელმისაწვდომი
// არაა — თავისუფალი ტექსტის ჩაწერაც კვლავ მუშაობს (ვალიდაცია
// value.trim()-ზეა, არა არჩევაზე). გამოიყენება RegisterScreen-სა და
// GoogleCompleteScreen-ში (customer-ისთვისაც და provider-ისთვისაც — ორივე
// ამ ორ ეკრანზე შედის, ცალკე მისამართის ველი Provider-ს არსად აქვს).
// შენიშვნა: Nominatim-ის უფასო public API-ს აქვს rate-limit (~1 req/sec) —
// მასშტაბის ზრდისას განსახილველია საკუთარი Nominatim instance ან ფასიანი
// providers (Google Places).
export function AddressAutocompleteField({ label, value, onChangeText, onSelect, onBlur, placeholder, error }: Props) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [showList, setShowList] = useState(false);
  const [fieldHeight, setFieldHeight] = useState(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const blurTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestSeq = useRef(0);

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
        const url = `https://nominatim.openstreetmap.org/search?format=json&limit=5&countrycodes=ge&accept-language=ka&q=${encodeURIComponent(query)}`;
        const res = await fetch(url, { headers: { 'User-Agent': 'ostati-app (Georgia local services marketplace)' } });
        const data = await res.json();
        if (seq !== requestSeq.current) return;
        setSuggestions(
          (Array.isArray(data) ? data : []).map((item: { place_id?: number | string; display_name: string }, idx: number) => ({
            id: `${item.place_id ?? idx}`,
            label: item.display_name,
          }))
        );
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
  };

  const handleBlur = () => {
    blurTimerRef.current = setTimeout(() => setShowList(false), BLUR_HIDE_DELAY_MS);
    onBlur?.();
  };

  const onFieldLayout = (e: LayoutChangeEvent) => setFieldHeight(e.nativeEvent.layout.height);

  const dropdownOpen = showList && value.trim().length >= MIN_QUERY_LEN && (loading || suggestions.length > 0);

  return (
    <View style={[styles.wrap, dropdownOpen ? styles.wrapElevated : null]}>
      <View onLayout={onFieldLayout}>
        <Text style={styles.label}>{label}</Text>
        <View style={styles.inputWrapper}>
          <View style={styles.leftIcon}>
            <MapPin size={15} color={colors.mutedForeground} />
          </View>
          <TextInput
            value={value}
            onChangeText={handleChangeText}
            onFocus={handleFocus}
            onBlur={handleBlur}
            placeholder={placeholder}
            placeholderTextColor={colors.mutedForeground}
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
}

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
