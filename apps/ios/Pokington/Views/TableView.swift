import SwiftUI

struct TableView: View {
    @StateObject private var vm = GameViewModel()
    @State private var selectedEmptySeat: Int? = nil
    @Environment(\.horizontalSizeClass) private var sizeClass

    private var isWideLayout: Bool { sizeClass == .regular }

    private var emptySeats: [Int] {
        (0..<10).filter { vm.players[$0] == nil }
    }

    /// Chip glow angle: 90° (down = toward you) on your turn;
    /// otherwise interpolates across the opponent strip left-to-right.
    private var chipGlowAngle: Double {
        if vm.isMyTurn { return 90 }
        let activeIdx = vm.opponents.firstIndex { $0.isCurrentActor } ?? -1
        let total = vm.opponents.count
        if activeIdx < 0 || total <= 1 { return -90 }
        let ratio = Double(activeIdx) / Double(total - 1) * 2 - 1  // -1…1
        return atan2(-200, ratio * 130) * (180 / Double.pi)
    }

    var body: some View {
        ZStack {
            // Background — fills entire screen including safe areas
            Color(hex: 0x030712).ignoresSafeArea()

            // Ambient red glow
            Circle()
                .fill(Color.red.opacity(0.06))
                .frame(width: isWideLayout ? 900 : 600, height: isWideLayout ? 600 : 400)
                .blur(radius: 120)

            if isWideLayout {
                iPadLayout
            } else {
                iPhoneLayout
            }
        }
        .navigationBarHidden(true)
        .sheet(item: $selectedEmptySeat) { seat in
            SitDownSheetView(
                seatIndex: seat,
                bigBlindCents: vm.blinds.big
            ) { name, buyInCents in
                vm.sitDown(seat: seat, name: name, buyInCents: buyInCents)
                selectedEmptySeat = nil
            }
            .presentationDetents([.height(380)])
            .presentationDragIndicator(.visible)
            .presentationBackground(.ultraThinMaterial)
        }
    }

    // MARK: - iPhone Layout

    private var iPhoneLayout: some View {
        VStack(spacing: 0) {
            // Zone 1: Header — standard VStack position; status bar area shows
            // matching dark background from the ZStack root, so the seam is invisible.
            TableHeaderView(
                tableName: vm.tableName,
                smallBlind: vm.blinds.small,
                bigBlind: vm.blinds.big
            )

            // Zone 2: Opponent strip
            OpponentScrollView(
                opponents: vm.opponents,
                dealerSeatIndex: vm.dealerSeatIndex,
                smallBlindIndex: vm.smallBlindIndex,
                bigBlindIndex: vm.bigBlindIndex,
                emptySeats: emptySeats,
                onEmptySeatTap: { seat in selectedEmptySeat = seat }
            )

            Spacer()

            // Zone 3: Chip + community cards — flex-1 center area
            VStack(spacing: 12) {
                PokerChipView(size: 38, glowAngle: chipGlowAngle)
                CommunityCardsView(
                    cards: vm.communityCards,
                    pot: vm.pot
                )
            }

            Spacer()

            // Zone 4: Hand panel
            HandPanelView(
                player: vm.myPlayer,
                holeCards: vm.holeCards,
                handStrength: vm.handStrength
            )
            .padding(.bottom, 8)

            // Zone 5: Action bar — background extends into home indicator via ignoresSafeArea
            ActionBarView(
                isYourTurn: vm.isMyTurn,
                waitingFor: vm.currentActorName,
                callAmount: vm.blinds.big,
                pot: vm.pot,
                stack: vm.myPlayer?.stack ?? 0,
                minRaise: vm.blinds.big * 2,
                onFold: { vm.fold() },
                onCall: { vm.call() },
                onRaise: { amount in vm.raise(to: amount) }
            )
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
    }

    // MARK: - iPad Layout (two-column)

    private var iPadLayout: some View {
        VStack(spacing: 0) {
            TableHeaderView(
                tableName: vm.tableName,
                smallBlind: vm.blinds.small,
                bigBlind: vm.blinds.big
            )

            HStack(alignment: .top, spacing: 0) {
                // Left column: opponents + chip + community cards
                VStack(spacing: 0) {
                    OpponentScrollView(
                        opponents: vm.opponents,
                        dealerSeatIndex: vm.dealerSeatIndex,
                        smallBlindIndex: vm.smallBlindIndex,
                        bigBlindIndex: vm.bigBlindIndex,
                        emptySeats: emptySeats,
                        onEmptySeatTap: { seat in selectedEmptySeat = seat }
                    )

                    Spacer()

                    VStack(spacing: 16) {
                        PokerChipView(size: 44, glowAngle: chipGlowAngle)
                        CommunityCardsView(cards: vm.communityCards, pot: vm.pot)
                            .scaleEffect(1.3)
                    }

                    Spacer()
                }
                .frame(maxWidth: .infinity)

                Rectangle()
                    .fill(Color.white.opacity(0.06))
                    .frame(width: 1)
                    .padding(.vertical, 24)

                VStack(spacing: 0) {
                    Spacer()
                    HandPanelView(
                        player: vm.myPlayer,
                        holeCards: vm.holeCards,
                        handStrength: vm.handStrength
                    )
                    Spacer()
                    ActionBarView(
                        isYourTurn: vm.isMyTurn,
                        waitingFor: vm.currentActorName,
                        callAmount: vm.blinds.big,
                        pot: vm.pot,
                        stack: vm.myPlayer?.stack ?? 0,
                        minRaise: vm.blinds.big * 2,
                        onFold: { vm.fold() },
                        onCall: { vm.call() },
                        onRaise: { amount in vm.raise(to: amount) }
                    )
                }
                .frame(maxWidth: 400)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
    }
}

// Make Int conform to Identifiable for sheet binding
extension Int: @retroactive Identifiable {
    public var id: Int { self }
}

// MARK: - Sit Down Sheet

struct SitDownSheetView: View {
    let seatIndex: Int
    let bigBlindCents: Int
    let onConfirm: (String, Int) -> Void

    @State private var name = ""
    @State private var selectedPresetIndex = 1   // default to middle preset
    @Environment(\.dismiss) private var dismiss

    /// Buy-in presets: 20 BB, 50 BB, 100 BB — mirrors web getBuyInPresets()
    private var presets: [(label: String, cents: Int)] {
        [(label: "20 BB", cents: 20 * bigBlindCents),
         (label: "50 BB", cents: 50 * bigBlindCents),
         (label: "100 BB", cents: 100 * bigBlindCents)]
    }

    private var canConfirm: Bool {
        !name.trimmingCharacters(in: .whitespaces).isEmpty
    }

    var body: some View {
        VStack(spacing: 20) {
            // Handle bar
            Capsule()
                .fill(Color.gray.opacity(0.4))
                .frame(width: 40, height: 4)
                .padding(.top, 12)

            // Seat title
            Text("Seat \(seatIndex + 1)")
                .font(.system(size: 18, weight: .black))
                .foregroundColor(.white)

            // Name field
            TextField("Your name", text: $name)
                .textFieldStyle(.plain)
                .padding()
                .background(Color.white.opacity(0.06))
                .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: 14, style: .continuous)
                        .stroke(Color.white.opacity(0.08), lineWidth: 1)
                )
                .foregroundColor(.white)

            // Buy-in label
            HStack {
                Text("BUY-IN")
                    .font(.system(size: 10, weight: .black))
                    .tracking(2)
                    .foregroundColor(.gray)
                Spacer()
                Text(presets[selectedPresetIndex].cents.formattedAsCents)
                    .font(.system(size: 14, weight: .black, design: .monospaced))
                    .foregroundColor(.white)
            }

            // Buy-in presets
            HStack(spacing: 8) {
                ForEach(presets.indices, id: \.self) { i in
                    Button {
                        UIImpactFeedbackGenerator(style: .light).impactOccurred()
                        selectedPresetIndex = i
                    } label: {
                        Text(presets[i].label)
                            .font(.system(size: 13, weight: .bold))
                            .foregroundColor(selectedPresetIndex == i ? Color(hex: 0xef4444) : .gray)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 10)
                            .background(
                                selectedPresetIndex == i
                                    ? Color(hex: 0xef4444).opacity(0.12)
                                    : Color(hex: 0x1f2937)
                            )
                            .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                            .overlay(
                                RoundedRectangle(cornerRadius: 12, style: .continuous)
                                    .stroke(
                                        selectedPresetIndex == i
                                            ? Color(hex: 0xef4444).opacity(0.35)
                                            : Color.clear,
                                        lineWidth: 1
                                    )
                            )
                    }
                    .animation(.spring(response: 0.25, dampingFraction: 0.8), value: selectedPresetIndex)
                }
            }

            // Confirm button
            Button {
                UIImpactFeedbackGenerator(style: .medium).impactOccurred()
                let trimmed = name.trimmingCharacters(in: .whitespaces)
                onConfirm(trimmed, presets[selectedPresetIndex].cents)
                dismiss()
            } label: {
                Text("Sit Down")
                    .font(.system(size: 16, weight: .black))
                    .foregroundColor(.white)
                    .frame(maxWidth: .infinity)
                    .frame(height: 56)
                    .background(
                        LinearGradient(
                            colors: [.red, Color(hex: 0xb91c1c)],
                            startPoint: .leading,
                            endPoint: .trailing
                        )
                    )
                    .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                    .shadow(color: .red.opacity(0.4), radius: 16)
            }
            .disabled(!canConfirm)
            .opacity(canConfirm ? 1 : 0.4)
        }
        .padding(.horizontal, 16)
        .padding(.bottom, 16)
        .background(Color(hex: 0x030712))
    }
}
