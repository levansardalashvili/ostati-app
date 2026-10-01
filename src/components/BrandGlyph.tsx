import React from 'react';
import { Circle, Path, Polygon, Svg } from 'react-native-svg';

type Props = {
  size?: number;
  color?: string;
};

// რეალური ბრენდის ნიშანი (რგოლი + ჰექს-კაკალი + წერტილი) — იგივე მარკი,
// რაც საიტის ლოგოშია გამოყენებული (ostati-site/public/logo-mark-white.png-ის
// საწყისი SVG, დიზაინერის Figma ექსპორტიდან). BrandMark.tsx-სა და
// CurvedAuthHeader.tsx-ს შორის გაზიარებული, რომ ერთი და იმავე ნახატის
// path-მონაცემები ორ ადგილას არ დუბლირდეს.
export function BrandGlyph({ size = 24, color = '#FFFFFF' }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Path
        d="M 50 10 C 72 10, 90 28, 90 50 C 90 72, 72 90, 50 90 C 32 90, 18 78, 12 62 C 8 50, 12 34, 22 22 L 36 34 C 30 42, 28 50, 31 58 C 34 66, 42 72, 50 72 C 62 72, 72 62, 72 50 C 72 38, 62 28, 50 28 L 50 10 Z"
        fill={color}
      />
      <Polygon points="50,34 62,42 62,58 50,66 38,58 38,42" fill={color} />
      <Circle cx={82} cy={18} r={7} fill={color} />
    </Svg>
  );
}
