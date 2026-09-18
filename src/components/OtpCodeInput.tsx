import React, { useEffect, useRef } from 'react';
import { TextField } from './TextField';

type Props = {
  value: string;
  onChangeText: (value: string) => void;
  onComplete: (code: string) => void;
  error?: string;
};

const CODE_LENGTH = 6;

// #107 — 6-ციფრიანი OTP-კოდის ველი (Phone*VerifyScreen-ების გაზიარებული).
// წმინდა პრეზენტაციული კომპონენტია — ბიზნეს-ლოგიკა (verify RPC-ის
// გამოძახება/შეცდომების დამუშავება) ეკრანების საქმეა. `TextField`-ის
// ახალ `maxLength` prop-ს იყენებს (იგივე ვიზუალური ენა, რაც დანარჩენ
// ველებს, ახალი style-ის დამატების გარეშე).
export function OtpCodeInput({ value, onChangeText, onComplete, error }: Props) {
  // `onComplete`-ის ერთხელ-გამოძახება ერთსა და იმავე 6-ციფრიან კოდზე —
  // მომხმარებელს რომ არასწორი კოდის შემდეგ backspace-ით ერთი ციფრი
  // წაეშალა და იგივე 6 ციფრი ხელახლა აეკრიფა, ორმაგი verify-ის ცდა არ
  // გაეშვას.
  const firedForRef = useRef<string | null>(null);

  useEffect(() => {
    if (value.length === CODE_LENGTH && firedForRef.current !== value) {
      firedForRef.current = value;
      onComplete(value);
    }
    if (value.length < CODE_LENGTH) {
      firedForRef.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <TextField
      testID="otp-code-input"
      label="კოდი"
      value={value}
      onChangeText={(v) => onChangeText(v.replace(/\D/g, '').slice(0, CODE_LENGTH))}
      placeholder="000000"
      error={error}
      keyboardType="number-pad"
      maxLength={CODE_LENGTH}
    />
  );
}
