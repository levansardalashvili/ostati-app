import { useRef } from 'react';
import { Animated } from 'react-native';

// გაზიარებული press-feedback hook — Button.tsx-ის იგივე scale-spring
// ეფექტი (#animations session), ბარათებზე/chip-ებზეც ხელახლა
// გამოსაყენებლად. განზრახ არ იყენებს `Animated.createAnimatedComponent
// (Pressable)`-ს — RN-ის ცნობილი footgun (`style`-ის function-ვარიანტს
// (`{pressed}` callback) ვერ ამუშავებს, background/border ჩუმად ქრება,
// იხ. Button.tsx-ის commit history). გამომძახებელმა უნდა შემოახვიოს
// პლეინ `Pressable` `<Animated.View style={{transform:[{scale}]}}>`-ში,
// საკუთარი style-ის უცვლელად დატოვებით.
export function usePressScale(scaleTo = 0.97) {
  const scale = useRef(new Animated.Value(1)).current;

  const onPressIn = () => {
    Animated.timing(scale, {
      toValue: scaleTo,
      useNativeDriver: true,
      duration: 30,
    }).start();
  };
  const onPressOut = () => {
    Animated.timing(scale, {
      toValue: 1,
      useNativeDriver: true,
      duration: 45,
    }).start();
  };

  return { scale, onPressIn, onPressOut };
}
