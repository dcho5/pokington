import { useState } from "react";

interface UseRaiseAmountOpts {
  minRaise: number;
  stack: number;
  pot: number;
  bigBlind: number;
  currentBet?: number;
}

export interface RaisePreset {
  label: string;
  value: number;
}

export function useRaiseAmount({ minRaise, stack, pot, bigBlind, currentBet = 0 }: UseRaiseAmountOpts) {
  const increment = Math.max(1, bigBlind > 0 ? bigBlind : 25);
  // When stack < minRaise, the only valid raise is a full all-in (stack itself).
  const allInTotal = currentBet + stack;
  const lowerBound = Math.min(minRaise, allInTotal);
  const [amount, setAmountRaw] = useState(lowerBound);

  const clamp = (v: number) => Math.max(lowerBound, Math.min(allInTotal, v));
  const setAmount = (v: number) => setAmountRaw(clamp(v));

  const presets: RaisePreset[] = [
    { label: "¼ Pot", value: Math.floor(pot * 0.25) },
    { label: "½ Pot", value: Math.floor(pot * 0.5) },
    { label: "¾ Pot", value: Math.floor(pot * 0.75) },
    { label: "Pot", value: pot },
    { label: "All-in", value: allInTotal },
  ];

  return { amount, setAmount, increment, lowerBound, presets, clamp, allInTotal };
}
