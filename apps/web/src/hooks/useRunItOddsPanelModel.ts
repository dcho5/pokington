"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Card } from "@pokington/shared";
import { deriveVisibleRunState } from "lib/runAnimation";
import type { TableLayoutScene } from "components/Table/tableScene";
import {
  buildRunItOddsContext,
  calculateExactRunItOdds,
  calculateFinalRunItOdds,
  createMonteCarloOddsAccumulator,
  createSeededRng,
  hashSeed,
  shouldShowRunItOddsPanel,
} from "lib/runItOdds.mjs";
import {
  buildRunItOddsRows,
  createRunItOddsSessionKey,
  lockRunItStreetSnapshot,
} from "lib/runItOddsPanelModel.mjs";

export type RunItOddsCalcStatus = "idle" | "computing" | "final";
export type RunItOddsStreet = "pre" | "flop" | "turn" | "river";

export interface RunItOddsPanelRow {
  playerId: string;
  playerName: string;
  holeCards: [Card, Card];
  currentPercentage: number | null;
  streetPercentages: Record<RunItOddsStreet, number | null>;
}

export interface RunItOddsPanelModel {
  visible: boolean;
  status: RunItOddsCalcStatus;
  currentRun: number;
  currentStreet: RunItOddsStreet;
  rows: RunItOddsPanelRow[];
  pulseKey: number;
}

const SAMPLE_COUNT = 20_000;
const SAMPLE_BATCH_SIZE = 1_000;

export function useRunItOddsPanelModel(scene: TableLayoutScene): RunItOddsPanelModel {
  const { currentRun } = deriveVisibleRunState(
    scene.runResults,
    scene.knownCardCount,
    Math.max(scene.runCount, scene.runResults.length, 1),
  );
  const panelVisible = shouldShowRunItOddsPanel({
    phase: scene.phase,
    players: scene.players,
    runResults: scene.runResults,
  });
  const sessionKey = useMemo(
    () => createRunItOddsSessionKey({
      handNumber: scene.handNumber,
      showdownStartedAt: scene.showdownStartedAt ?? null,
      runDealStartedAt: scene.runDealStartedAt ?? null,
    }),
    [scene.handNumber, scene.runDealStartedAt, scene.showdownStartedAt],
  );
  const context = useMemo(
    () => (
      panelVisible
        ? buildRunItOddsContext({
            players: scene.players,
            runResults: scene.runResults,
            currentRun,
          })
        : null
    ),
    [currentRun, panelVisible, scene.players, scene.runResults],
  );

  const [historyByRun, setHistoryByRun] = useState<Record<number, Record<string, Record<string, number>>>>({});
  const [currentPercentages, setCurrentPercentages] = useState<Record<string, number>>({});
  const [status, setStatus] = useState<RunItOddsCalcStatus>("idle");
  const [pulseKey, setPulseKey] = useState(0);
  const generationRef = useRef(0);
  const completedCalcKeyRef = useRef<string | null>(null);

  useEffect(() => {
    generationRef.current += 1;
    completedCalcKeyRef.current = null;
    setHistoryByRun({});
    setCurrentPercentages({});
    setStatus("idle");
  }, [sessionKey]);

  useEffect(() => {
    generationRef.current += 1;

    if (!context) {
      setCurrentPercentages({});
      setStatus("idle");
      return;
    }

    const generation = generationRef.current;
    const calcKey = `${sessionKey}:${context.contextKey}`;
    const finalizeStreet = (percentages: Record<string, number>, nextStatus: RunItOddsCalcStatus) => {
      if (generationRef.current !== generation) return;
      setCurrentPercentages(percentages);
      setStatus(nextStatus);
      setHistoryByRun((previous) => lockRunItStreetSnapshot(previous, {
        runIndex: context.currentRun,
        street: context.street,
        percentages,
      }));
      if (completedCalcKeyRef.current !== calcKey) {
        completedCalcKeyRef.current = calcKey;
        setPulseKey((value) => value + 1);
      }
    };

    if (context.mode === "final") {
      finalizeStreet(calculateFinalRunItOdds(context), "final");
      return;
    }

    if (context.mode === "exact") {
      finalizeStreet(calculateExactRunItOdds(context), "idle");
      return;
    }

    setStatus("computing");
    setCurrentPercentages({});

    const accumulator = createMonteCarloOddsAccumulator(context, {
      sampleCount: SAMPLE_COUNT,
      rng: createSeededRng(hashSeed(calcKey)),
    });

    const step = () => {
      if (generationRef.current !== generation) return;
      const result = accumulator.runBatch(SAMPLE_BATCH_SIZE);
      setCurrentPercentages(result.percentages);
      if (result.done) {
        finalizeStreet(result.percentages, "idle");
        return;
      }
      window.setTimeout(step, 0);
    };

    step();
  }, [context, sessionKey]);

  const rows = useMemo(() => {
    if (!context) return [];
    return buildRunItOddsRows({
      contenders: context.contenders as Array<{ playerId: string; playerName: string; holeCards: [Card, Card] }>,
      historyByRun,
      currentRun: context.currentRun,
      currentStreet: context.street,
      currentPercentages,
    }) as RunItOddsPanelRow[];
  }, [context, currentPercentages, historyByRun]);

  return {
    visible: !!context,
    status,
    currentRun: context?.currentRun ?? 0,
    currentStreet: (context?.street ?? "pre") as RunItOddsStreet,
    rows,
    pulseKey,
  };
}
