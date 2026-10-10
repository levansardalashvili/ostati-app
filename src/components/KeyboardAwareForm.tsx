import React, { createContext, useCallback, useContext, useRef } from 'react';
import { Keyboard, KeyboardAvoidingView, Platform, ScrollView, ScrollViewProps, TextInput } from 'react-native';
import { KEYBOARD_SHOW_EVENT } from '../utils/useKeyboardVisible';

type ScrollToInput = (input: TextInput | null) => void;
const ScrollFormContext = createContext<ScrollToInput | null>(null);

// space left between the focused field and the keyboard (room for the hint/next label)
const EXTRA_OFFSET = 72;
// wait for the keyboard animation, header collapse and KeyboardAvoidingView resize
const SETTLE_MS = 250;

type Props = ScrollViewProps & {
  children: React.ReactNode;
  // fixed-footer ეკრანებს (`CustomerEditProfile`/`ProviderEditProfile`/
  // `ProviderSetup`/`PostJob`/`Rating`) უკვე აქვთ საკუთარი გარე
  // `KeyboardAvoidingView` (footer-ის სწორად ასაწევად) — იქ ეს
  // კომპონენტი მხოლოდ ScrollView+Context უნდა იყოს, მეორე ჩალაგებული
  // KeyboardAvoidingView არც საჭიროა და გავლენასაც მოახდენდა footer-ის
  // პოზიციაზე.
  avoidKeyboard?: boolean;
};

// ჩანაცვლებს `react-native-keyboard-aware-scroll-view`-ს (მანამდე
// გამოყენებული ყველა auth/ფორმის ეკრანზე) — ის React Native-ის New
// Architecture-ზე (Fabric, Expo SDK 57-ის default) რეალურად დაშლილია:
// `_updateKeyboardSpace`-ში ეყრდნობა ძველ `UIManager.measureInWindow`/
// `UIManager.viewIsDescendantOf` static API-ებს, რომლებიც Fabric-ზე
// აღარ მუშაობს — ჩუმად, ყოველგვარი შეცდომის/warning-ის გარეშე, ამიტომ
// მანამდე ვერცერთმა ეკრანმა ვერ დაინახა, რომ საერთოდ არ ხდებოდა
// ავტო-სქროლვა ფოკუსირებულ ველამდე (Login-ზე მხოლოდ იმიტომ "მუშაობდა",
// რომ მისი content ისედაც საკმარისად მოკლეა კლავიატურის გარეშეც
// მოსატევად).
//
// ამის ნაცვლად აქ პირდაპირ გამოიყენება React Native-ის საკუთარი,
// Fabric-ზეც სწორად მუშა `ScrollView.scrollResponderScrollNativeHandleToKeyboard`
// (TextInput-ის ref-ის `.measureLayout()` instance-მეთოდს იძახებს, არა
// deprecated static UIManager-ს) — ზუსტად ის მექანიზმი, რასაც გატეხილი
// ბიბლიოთეკა თავად ცდილობდა გაეხვია.
export function KeyboardAwareForm({
  children,
  contentContainerStyle,
  style,
  avoidKeyboard = true,
  ...rest
}: Props) {
  const scrollRef = useRef<ScrollView>(null);
  const scrollY = useRef(0);

  // RN's own scrollResponderScrollNativeHandleToKeyboard assumes the ScrollView
  // starts at the top of the screen — with a header above it the field lands
  // under the keyboard by the header's height. So measure the field in window
  // coordinates against the keyboard's real top instead, and only after the
  // keyboard (and any header collapse / KeyboardAvoidingView resize) has settled.
  const scrollToInput = useCallback<ScrollToInput>((input) => {
    if (!input) return;
    const run = () =>
      setTimeout(() => {
        const kb = Keyboard.metrics();
        if (!kb || !scrollRef.current) return;
        // visible bottom = keyboard top, or higher if a fixed footer (save button) sits above the keyboard
        scrollRef.current.getNativeScrollRef()?.measureInWindow((_sx, sy, _sw, sh) => {
          const visibleBottom = Math.min(kb.screenY, sy + sh);
          input.measureInWindow((_x, y, _w, h) => {
            const overflow = y + Math.min(h, visibleBottom - sy - EXTRA_OFFSET) + EXTRA_OFFSET - visibleBottom;
            if (overflow > 0) scrollRef.current?.scrollTo({ y: scrollY.current + overflow, animated: true });
          });
        });
      }, SETTLE_MS);
    if (Keyboard.isVisible()) {
      run();
      return;
    }
    const sub = Keyboard.addListener(KEYBOARD_SHOW_EVENT, () => {
      sub.remove();
      run();
    });
    setTimeout(() => sub.remove(), 1500);
  }, []);

  const body = (
    <ScrollFormContext.Provider value={scrollToInput}>
      <ScrollView
        ref={scrollRef}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={contentContainerStyle}
        style={avoidKeyboard ? undefined : style}
        scrollEventThrottle={16}
        {...rest}
        onScroll={(e) => {
          scrollY.current = e.nativeEvent.contentOffset.y;
          rest.onScroll?.(e);
        }}
      >
        {children}
      </ScrollView>
    </ScrollFormContext.Provider>
  );

  if (!avoidKeyboard) return body;

  return (
    <KeyboardAvoidingView style={[{ flex: 1 }, style]} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      {body}
    </KeyboardAvoidingView>
  );
}

// `TextField`/`AddressAutocompleteField`-ის (და phone-ის ცალკეული ველების)
// მიერ გამოსაძახებელი — `ref`+`onFocus` წყვილს აბრუნებს, TextInput-ზე
// პირდაპირ ჩასასმელად. `KeyboardAwareForm`-ის გარეთ (Context არ
// არსებობს, მაგ. BottomSheet-ის შიგნით) უსაფრთხო no-op-ია.
export function useScrollIntoViewOnFocus() {
  const scrollToInput = useContext(ScrollFormContext);
  const ref = useRef<TextInput>(null);
  const onFocus = useCallback(() => {
    scrollToInput?.(ref.current);
  }, [scrollToInput]);
  return { ref, onFocus };
}

// დამატებითი, "raw" `<TextInput>`-ების (ტელეფონის ციფრები, "ჩემ
// შესახებ"/აღწერის textarea-ები — TextField/AddressAutocompleteField-ის
// გარეთ) მინიმალური drop-in ჩანაცვლება — ყველა prop-ი გამჭვირვალედ
// გადადის, `onFocus` მხოლოდ ემატება (არ ცვლის) ველის საკუთარ handler-ს.
export const ScrollAwareTextInput = React.forwardRef<TextInput, React.ComponentProps<typeof TextInput>>(
  function ScrollAwareTextInput({ onFocus, ...props }, forwardedRef) {
    const { ref, onFocus: scrollOnFocus } = useScrollIntoViewOnFocus();
    return (
      <TextInput
        {...props}
        ref={(node) => {
          ref.current = node;
          if (typeof forwardedRef === 'function') forwardedRef(node);
          else if (forwardedRef) (forwardedRef as React.MutableRefObject<TextInput | null>).current = node;
        }}
        onFocus={(e) => {
          scrollOnFocus();
          onFocus?.(e);
        }}
      />
    );
  },
);
