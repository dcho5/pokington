"use client";
import React, { useEffect } from "react";
import { computeSeatPosition, type TableGeometry } from "lib/seatLayout";
import { motion, AnimatePresence, useAnimation } from "framer-motion";
import { formatCents } from "lib/formatCents";
import { ACTION_COLORS_DESKTOP as ACTION_COLORS } from "lib/actionColors";
import type { Player } from "types/player";
import Card from "components/poker/Card";

/** Two mini card backs indicating a player has been dealt cards */
function MiniCardIndicator({ visible, folded }: { visible: boolean; folded: boolean }) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, scale: 0.3, y: -8 }}
          animate={folded
            ? { opacity: 0, scale: 0.5, rotate: 15, y: -20 }
            : { opacity: 1, scale: 1, y: 0 }
          }
          exit={{ opacity: 0, scale: 0.5, rotate: 15, y: -20 }}
          transition={{ type: "spring", stiffness: 400, damping: 22 }}
          className="flex gap-0.5 mb-1"
        >
          <div className="w-4 h-5 rounded-[3px] bg-gradient-to-br from-[#1e3a5f] to-[#0f2040] border border-white/20 shadow-sm" />
          <div className="w-4 h-5 rounded-[3px] bg-gradient-to-br from-[#1e3a5f] to-[#0f2040] border border-white/20 shadow-sm -ml-2 rotate-3" />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

interface SeatProps {
  seatIndex: number;
  totalSeats: number;
  geometry: TableGeometry;
  player: Player | null;
  isYou: boolean;
  isDealer: boolean;
  isCurrentActor: boolean;
  onSitDown: (seatIndex: number) => void;
  seatSize?: number;
  handNumber?: number;
}

const Seat: React.FC<SeatProps> = ({
  seatIndex,
  totalSeats,
  geometry,
  player,
  isYou,
  isCurrentActor,
  onSitDown,
  seatSize = 100,
  handNumber = 0,
}) => {
  const pos = computeSeatPosition(seatIndex, totalSeats, geometry);
  const action = player?.lastAction ?? null;
  const actionStyle = action ? ACTION_COLORS[action] ?? ACTION_COLORS.check : null;

  // Win animation: bounce everything (cards + seat) together
  const bounceControls = useAnimation();
  useEffect(() => {
    if (!player?.winAnimationKey) return;
    if (player.winType === "full") {
      bounceControls.start({
        scale: [1, 1.1, 0.95, 1.05, 1],
        transition: { duration: 0.55, ease: "easeOut" },
      });
    } else {
      bounceControls.start({
        scale: [1, 1.06, 0.97, 1.02, 1],
        transition: { duration: 0.45, ease: "easeOut" },
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player?.winAnimationKey]);

  return (
    <motion.div
      className="absolute -translate-x-1/2 -translate-y-1/2 z-20"
      style={pos}
      initial={false}
    >
      <AnimatePresence mode="wait">
        {player ? (
          // Bounce wrapper — contains both peeking cards (z-0) and seat bubble (z-10)
          <motion.div key="occupied" animate={bounceControls} className="relative">

            {/* Showdown cards: peek over the top of the seat from behind (z-0) */}
            {player.holeCards && (
              <div
                className="absolute z-0 flex pointer-events-none"
                style={{
                  top: 0,
                  left: "50%",
                  transform: "translate(-50%, -50%)",
                  gap: 6,
                }}
              >
                {/* 7-2 eligible glow overlay */}
                {player.sevenTwoEligible && (
                  <motion.div
                    className="absolute inset-[-10px] rounded-xl pointer-events-none"
                    animate={{ opacity: [0.5, 1, 0.5], scale: [1, 1.06, 1] }}
                    transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
                    style={{ background: "radial-gradient(ellipse, rgba(234,179,8,0.55) 0%, transparent 70%)" }}
                  />
                )}

                {/* Floating badge */}
                {player.sevenTwoEligible && (
                  <motion.div
                    className="absolute z-20 text-[9px] font-black text-yellow-300 bg-black/80 px-2 py-0.5 rounded-full border border-yellow-400/50 whitespace-nowrap pointer-events-none"
                    style={{ top: "-26px", left: "50%", transform: "translateX(-50%)" }}
                    animate={{ y: [0, -3, 0] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  >
                    Show for 7-2 bounty! 💰
                  </motion.div>
                )}

                {player.holeCards.map((card, i) => (
                  <motion.div
                    key={card ? `${card.rank}${card.suit}-${handNumber}` : `back-${i}-${handNumber}`}
                    initial={{ scale: 0.5, opacity: 0, y: 16, rotateY: 90 }}
                    animate={player.sevenTwoEligible
                      ? {
                          scale: 1, opacity: 1, y: 0, rotateY: 0,
                          filter: [
                            "drop-shadow(0 0 8px rgba(234,179,8,0.8))",
                            "drop-shadow(0 0 16px rgba(234,179,8,1))",
                            "drop-shadow(0 0 8px rgba(234,179,8,0.8))",
                          ],
                        }
                      : { scale: 1, opacity: 1, y: 0, rotateY: 0 }
                    }
                    transition={player.sevenTwoEligible
                      ? { duration: 1.2, repeat: Infinity, ease: "easeInOut" }
                      : {
                          delay: i * 0.1,
                          duration: 0.4,
                          type: "spring",
                          stiffness: 280,
                          damping: 22,
                        }
                    }
                    style={{
                      rotate: i === 0 ? -8 : 8,
                      transformOrigin: "bottom center",
                      perspective: 600,
                    }}
                  >
                    <Card card={card ?? undefined} className="w-[50px] h-[70px] rounded-xl shadow-2xl" />
                  </motion.div>
                ))}
              </div>
            )}

            {/* Seat bubble — z-10 sits in front of the cards */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 10 }}
              animate={{
                opacity: player.isFolded ? 0.4 : 1,
                scale: 1,
                y: 0,
              }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.3 }}
              className={`
                relative z-10 flex flex-col items-center justify-center p-3 rounded-2xl shadow-xl border backdrop-blur-md transition-all duration-300
                ${isCurrentActor
                  ? "ring-2 ring-red-500 ring-offset-4 ring-offset-transparent"
                  : player.isFolded
                    ? "border-gray-400/30 dark:border-gray-700/30"
                    : "border-gray-200 dark:border-gray-800"}
                ${isYou ? "bg-white dark:bg-gray-900" : "bg-white/80 dark:bg-gray-950/80"}
              `}
              style={{ width: seatSize * 1.2 }}
            >
              {/* Win animation rings */}
              <AnimatePresence>
                {player.winAnimationKey && player.winType === "full" && (
                  <motion.span
                    key={`${player.winAnimationKey}-r1`}
                    className="absolute inset-[-4px] rounded-2xl pointer-events-none"
                    initial={{ opacity: 0.9, scale: 1 }}
                    animate={{ opacity: 0, scale: 1.45 }}
                    transition={{ duration: 1.1, ease: "easeOut" }}
                    style={{ border: "2.5px solid rgba(234,179,8,0.95)" }}
                  />
                )}
                {player.winAnimationKey && player.winType === "full" && (
                  <motion.span
                    key={`${player.winAnimationKey}-r2`}
                    className="absolute inset-[-4px] rounded-2xl pointer-events-none"
                    initial={{ opacity: 0.6, scale: 1 }}
                    animate={{ opacity: 0, scale: 1.75 }}
                    transition={{ duration: 1.5, ease: "easeOut", delay: 0.18 }}
                    style={{ border: "2px solid rgba(234,179,8,0.55)" }}
                  />
                )}
                {player.winAnimationKey && player.winType === "full" && (
                  <motion.div
                    key={`${player.winAnimationKey}-flash`}
                    className="absolute inset-0 rounded-2xl pointer-events-none"
                    initial={{ opacity: 0.35 }}
                    animate={{ opacity: 0 }}
                    transition={{ duration: 0.7 }}
                    style={{ background: "linear-gradient(135deg, rgba(234,179,8,0.35), rgba(253,230,138,0.18))" }}
                  />
                )}
                {player.winAnimationKey && player.winType === "partial" && (
                  <motion.span
                    key={`${player.winAnimationKey}-r1`}
                    className="absolute inset-[-4px] rounded-2xl pointer-events-none"
                    initial={{ opacity: 0.85, scale: 1 }}
                    animate={{ opacity: 0, scale: 1.35 }}
                    transition={{ duration: 0.9, ease: "easeOut" }}
                    style={{ border: "2px solid rgba(34,197,94,0.9)" }}
                  />
                )}
              </AnimatePresence>

              {/* During play: mini card backs. At showdown: cards are outside/above (see above). */}
              {!player.holeCards && (
                <MiniCardIndicator
                  key={handNumber}
                  visible={player.hasCards ?? false}
                  folded={player.isFolded ?? false}
                />
              )}

              <div className="flex items-center gap-1.5 mb-1 w-full justify-center">
                <span className={`text-sm font-bold truncate ${
                  player.isFolded ? "text-gray-400 dark:text-gray-600" :
                  isYou ? "text-red-600 dark:text-red-500" :
                  "text-gray-900 dark:text-gray-100"
                }`}>
                  {player.name}
                </span>
                {isYou && (
                  <span className="text-[10px] bg-red-100 dark:bg-red-900/30 text-red-600 px-1.5 py-0.5 rounded-md font-black uppercase">
                    You
                  </span>
                )}
              </div>

              <div className={`text-lg font-mono font-black tabular-nums ${
                player.isFolded ? "text-gray-400 dark:text-gray-600" : "text-gray-800 dark:text-gray-200"
              }`}>
                {formatCents(player.stack)}
              </div>

              {/* Last action badge */}
              <AnimatePresence>
                {action && actionStyle && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.7, y: 4 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.7 }}
                    transition={{ type: "spring", stiffness: 500, damping: 25 }}
                    className={`mt-1 px-2 py-0.5 rounded-full border text-[9px] font-black uppercase tracking-wider ${actionStyle.bg} ${actionStyle.text}`}
                  >
                    {action}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* All-in indicator */}
              {player.isAllIn && !player.holeCards && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="mt-1 px-3 py-0.5 rounded-full bg-gradient-to-r from-amber-500 to-yellow-500 shadow-[0_0_12px_rgba(245,158,11,0.5)] text-black text-[10px] font-black uppercase tracking-wider"
                >
                  ALL IN
                </motion.div>
              )}

              {/* Winning hand label — key triggers re-animation on each run update */}
              {player.handLabel && (
                <motion.div
                  key={player.handLabel}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                  className="mt-1 px-2 py-0.5 rounded-full text-[9px] font-black tracking-wide whitespace-nowrap"
                  style={{ background: "rgba(0,0,0,0.78)", color: "#fde68a", border: "1px solid rgba(234,179,8,0.3)" }}
                >
                  {player.handLabel}
                </motion.div>
              )}

              {player.isAdmin && (
                <div className="absolute -top-2 -right-2 bg-gray-900 dark:bg-white text-white dark:text-black text-[9px] px-2 py-0.5 rounded-full font-bold shadow-md">
                  ADMIN
                </div>
              )}

              {isCurrentActor && (
                <span className="absolute inset-[-4px] rounded-2xl animate-pulse-ring pointer-events-none" />
              )}
            </motion.div>
          </motion.div>
        ) : (
          <motion.button
            key="empty"
            whileHover={{ scale: 1.05, backgroundColor: "rgba(239, 68, 68, 0.1)" }}
            whileTap={{ scale: 0.95 }}
            onClick={() => onSitDown(seatIndex)}
            className="group flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-300 dark:border-gray-700 bg-transparent transition-all duration-200"
            style={{ width: seatSize, height: seatSize }}
          >
            <span className="text-xs font-bold text-gray-400 dark:text-gray-500 group-hover:text-red-500 transition-colors uppercase tracking-widest">
              Sit
            </span>
            <span className="text-[10px] text-gray-400/50 dark:text-gray-600 font-mono">
              {seatIndex + 1}
            </span>
          </motion.button>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default Seat;
