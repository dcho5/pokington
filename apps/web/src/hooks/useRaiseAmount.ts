import { useState } from "react";

interface UseRaiseAmountOpts {
  minRaise: number;
  stack: number;
  pot: number;
  bigBlind: number;
}

export interface RaisePreset {
  label: string;
  value: number;
}

export function useRaiseAmount({ minRaise, stack, pot, bigBlind }: UseRaiseAmountOpts) {
  const increment = Math.max(1, Math.round((bigBlind > 0 ? bigBlind : 25) / 5));
  // When stack < minRaise, the only valid raise is a full all-in (stack itself).
  const lowerBound = Math.min(minRaise, stack);
  const [amount, setAmountRaw] = useState(lowerBound);

  const clamp = (v: number) => Math.max(lowerBound, Math.min(stack, v));
  const setAmount = (v: number) => setAmountRaw(clamp(v));

  const presets: RaisePreset[] = [
    { label: "¼ Pot", value: Math.floor(pot * 0.25) },
    { label: "½ Pot", value: Math.floor(pot * 0.5) },
    { label: "¾ Pot", value: Math.floor(pot * 0.75) },
    { label: "Pot", value: pot },
    { label: "All-in", value: stack },
  ];

  return { amount, setAmount, increment, lowerBound, presets, clamp };
}
