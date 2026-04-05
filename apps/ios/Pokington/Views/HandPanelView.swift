import SwiftUI

// MARK: - Peelable Card

private struct PeelCardView: View {
    let card: Card?
    var onRevealChange: ((Bool) -> Void)? = nil

    @State private var committed: CGFloat = 0
    @State private var hasRevealed = false   // ratchet — fires onRevealChange only once
    @GestureState private var dragDelta: CGFloat = 0

    private let cardWidth: CGFloat = 88
    private let cardHeight: CGFloat = 130

    private var progress: CGFloat {
        min(1, max(0, committed + dragDelta))
    }

    var body: some View {
        ZStack {
            // Back face — clips from bottom going up as card is peeled
            CardView(card: nil)
                .frame(width: cardWidth, height: cardHeight)
                .mask(
                    VStack(spacing: 0) {
                        Color.black.frame(height: cardHeight * (1 - progress))
                        Color.clear.frame(height: cardHeight * progress)
                    }
                    .frame(width: cardWidth, height: cardHeight)
                    .clipped()
                )

            // Front face — reveals from bottom going up
            CardView(card: card)
                .frame(width: cardWidth, height: cardHeight)
                .mask(
                    VStack(spacing: 0) {
                        Color.clear.frame(height: cardHeight * (1 - progress))
                        Color.black.frame(height: cardHeight * progress)
                    }
                    .frame(width: cardWidth, height: cardHeight)
                    .clipped()
                )

            // Shadow strip at peel boundary for depth
            if progress > 0.02 && progress < 0.98 {
                Rectangle()
                    .fill(
                        LinearGradient(
                            colors: [Color.black.opacity(0.5), Color.clear],
                            startPoint: .top,
                            endPoint: .bottom
                        )
                    )
                    .frame(width: cardWidth, height: 28)
                    .offset(y: -(cardHeight / 2) + cardHeight * (1 - progress))
                    .allowsHitTesting(false)
            }
        }
        .frame(width: cardWidth, height: cardHeight)
        // drop-shadow on ZStack pierces through masks just like web filter: drop-shadow()
        .shadow(color: .black.opacity(0.55), radius: 12, y: 6)
        .overlay(
            Group {
                if progress < 0.12 {
                    VStack {
                        Spacer()
                        Text("peek ↑")
                            .font(.system(size: 8, weight: .black))
                            .tracking(1.5)
                            .foregroundColor(.white.opacity(0.5))
                            .padding(.bottom, 5)
                    }
                    .allowsHitTesting(false)
                }
            }
        )
        .gesture(
            DragGesture()
                .updating($dragDelta) { value, state, _ in
                    state = -value.translation.height / (cardHeight * 0.85)
                }
                .onEnded { value in
                    let total = min(1, max(0, committed + (-value.translation.height / (cardHeight * 0.85))))
                    let target: CGFloat = total > 0.4 ? 1.0 : 0.0
                    withAnimation(.spring(response: 0.3, dampingFraction: 0.7)) {
                        committed = target
                    }
                    if target == 1.0 && !hasRevealed {
                        hasRevealed = true
                        onRevealChange?(true)
                    }
                }
        )
        // Mid-drag auto-snap: cross 50% from below → immediately snap to fully revealed
        .onChange(of: progress) { _, newProgress in
            if newProgress >= 0.5 && committed < 0.5 {
                withAnimation(.spring(response: 0.28, dampingFraction: 0.65)) {
                    committed = 1.0
                }
                if !hasRevealed {
                    hasRevealed = true
                    onRevealChange?(true)
                }
            }
        }
    }
}

// MARK: - HoleCardsView

struct HoleCardsView: View {
    let holeCards: [Card]?
    /// Fires once when both cards have been revealed at least once (ratchet — never fires false).
    var onBothRevealed: (() -> Void)? = nil

    @State private var card0Revealed = false
    @State private var card1Revealed = false

    var body: some View {
        HStack(alignment: .bottom, spacing: 10) {
            PeelCardView(
                card: (holeCards?.count ?? 0) > 0 ? holeCards?[0] : nil,
                onRevealChange: { revealed in
                    if revealed && !card0Revealed {
                        card0Revealed = true
                        if card1Revealed { onBothRevealed?() }
                    }
                }
            )
            PeelCardView(
                card: (holeCards?.count ?? 0) > 1 ? holeCards?[1] : nil,
                onRevealChange: { revealed in
                    if revealed && !card1Revealed {
                        card1Revealed = true
                        if card0Revealed { onBothRevealed?() }
                    }
                }
            )
        }
    }
}

// MARK: - HandPanelView

struct HandPanelView: View {
    let player: PublicPlayerState?
    let holeCards: [Card]?
    let handStrength: String?

    /// Ratchet: true once both cards have been revealed at least once.
    @State private var bothCardsRevealed = false

    var body: some View {
        if let player {
            VStack(spacing: 8) {
                // Hole cards — centered, vertical, peelable
                HoleCardsView(holeCards: holeCards) {
                    bothCardsRevealed = true
                }

                // Player info strip
                HStack {
                    HStack(spacing: 10) {
                        Circle()
                            .fill(AvatarColor.color(for: player.name))
                            .frame(width: 36, height: 36)
                            .overlay(
                                Text(AvatarColor.initials(for: player.name))
                                    .font(.system(size: 12, weight: .black))
                                    .foregroundColor(.white)
                            )

                        VStack(alignment: .leading, spacing: 2) {
                            // "YOU" pill badge — matches web red-100 bg + text-red-600
                            Text("YOU")
                                .font(.system(size: 9, weight: .black))
                                .foregroundColor(Color(hex: 0xdc2626))
                                .padding(.horizontal, 6)
                                .padding(.vertical, 2)
                                .background(Color(hex: 0xdc2626).opacity(0.12))
                                .clipShape(RoundedRectangle(cornerRadius: 4, style: .continuous))

                            Text(player.name)
                                .font(.system(size: 12, weight: .bold))
                                .foregroundColor(.white)
                                .lineLimit(1)
                        }
                    }

                    Spacer()

                    HStack(spacing: 20) {
                        // Hand strength — only shown once both cards revealed (ratchet)
                        if bothCardsRevealed, let hs = handStrength {
                            VStack(spacing: 2) {
                                Text("HAND")
                                    .font(.system(size: 9, weight: .black))
                                    .tracking(1.5)
                                    .foregroundColor(.gray)
                                Text(hs)
                                    .font(.system(size: 12, weight: .black))
                                    .foregroundColor(.white)
                            }
                            .transition(.opacity.combined(with: .scale(scale: 0.9)))
                        }

                        VStack(spacing: 2) {
                            Text("STACK")
                                .font(.system(size: 9, weight: .black))
                                .tracking(1.5)
                                .foregroundColor(.gray)
                            Text(player.stack.formattedAsCents)
                                .font(.system(size: 14, weight: .black, design: .monospaced))
                                .foregroundColor(.white)
                        }
                    }
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 10)
                .background(Color.white.opacity(0.06))
                .overlay(
                    RoundedRectangle(cornerRadius: 16, style: .continuous)
                        .stroke(Color.white.opacity(0.08), lineWidth: 1)
                )
                .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                .padding(.horizontal, 16)
            }
            .frame(maxWidth: .infinity)
            .animation(.spring(response: 0.3, dampingFraction: 0.8), value: bothCardsRevealed)
        }
    }
}
