import { useEffect, useState } from 'react';
import { Keyboard, Platform } from 'react-native';

export const KEYBOARD_SHOW_EVENT = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
export const KEYBOARD_HIDE_EVENT = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

export function useKeyboardVisible(): boolean {
  const [visible, setVisible] = useState(Keyboard.isVisible());
  useEffect(() => {
    const show = Keyboard.addListener(KEYBOARD_SHOW_EVENT, () => setVisible(true));
    const hide = Keyboard.addListener(KEYBOARD_HIDE_EVENT, () => setVisible(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return visible;
}
