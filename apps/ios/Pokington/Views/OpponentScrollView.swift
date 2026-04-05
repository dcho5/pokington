import SwiftUI

struct PlayerBubbleView: View {
    let player: PublicPlayerState
    let isDealer: Bool
    let isSmallBlind: Bool
    let isBigBlind: Bool

    var body: some View {
        VStack(spacing: 3) {
            // Avatar
            ZStack {
                if player.isCurrentActor {
                    Circle()
                        .stroke(Color.red.opacity(0.5), lineWidth: 2.5)
                        .frame(width: 82, height: 82)
                        .scaleEffect(1.08)
                        .opacity(0.6)
                }

                Circle()
                    .fill(AvatarColor.color(for: player.name))
                    .frame(width: 75, height: 75)
                    .overlay(
                        Text(AvatarColor.initials(for: player.name))
                            .font(.system(size: 22, weight: .black))
                            .foregroundColor(.white)
                    )
                    .overlay(
                        player.isCurrentActor
                            ? Circle().stroke(Color.red, lineWidth: 2.5) : nil
                    )
                    .shadow(
                        color: player.isCurrentActor ? .red.opacity(0.55) : .black.opacity(0.3),
                        radius: player.isCurrentActor ? 10 : 4
                    )

                // Dealer badge
                if isDealer {
                    Circle()
                        .fill(.white)
                        .frame(width: 28, height: 28)
                        .overlay(Circle().stroke(Color.red, lineWidth: 1))
                        .overlay(
                            Text("D")
                                .font(.system(size: 9, weight: .black))
                                .foregroundColor(.red)
                        )
                        .offset(x: 24, y: 24)
                }

                // Blind badge
                if !isDealer && (isSmallBlind || isBigBlind) {
                    Circle()
                        .fill(Color(hex: 0x1f2937))
                        .frame(width: 28, height: 28)
                        .overlay(
                            Text(isSmallBlind ? "1" : "2")
                                .font(.system(size: 11, weight: .black))
                                .foregroundColor(.yellow)
                        )
                        .offset(x: 24, y: -24)
                }
            }

            // Name
            Text(player.name)
                .font(.system(size: 12, weight: .semibold))
                .foregroundColor(Color(hex: 0xd1d5db))
                .lineLimit(1)
                .frame(maxWidth: 80)

            // Stack
            Text(player.stack.formattedAsCents)
                .font(.system(size: 13, weight: .bold, design: .monospaced))
                .foregroundColor(.white)

            // Reserved space for future bet/raise amount chip
            Color.clear.frame(height: 20)
        }
        .frame(minWidth: 90)
    }
}

struct EmptySeatBubbleView: View {
    let seatIndex: Int
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            VStack(spacing: 3) {
                Circle()
                    .strokeBorder(style: StrokeStyle(lineWidth: 2, dash: [5]))
                    .foregroundColor(.gray.opacity(0.5))
                    .frame(width: 75, height: 75)
                    .overlay(
                        Text("+")
                            .font(.system(size: 28, weight: .bold))
                            .foregroundColor(.gray.opacity(0.5))
                    )

                Text("Seat \(seatIndex + 1)")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundColor(.gray.opacity(0.5))

                // Reserved space for future bet/raise amount chip
                Color.clear.frame(height: 20)
            }
            .frame(minWidth: 90)
        }
    }
}

/// Merge all items into clockwise order, display as two rows
/// with a center gap in row 2 representing the player's own seat.
struct OpponentScrollView: View {
    let opponents: [PublicPlayerState]
    let dealerSeatIndex: Int
    let smallBlindIndex: Int?
    let bigBlindIndex: Int?
    let emptySeats: [Int]
    var onEmptySeatTap: ((Int) -> Void)? = nil

    private enum SeatItem: Identifiable {
        case player(PublicPlayerState)
        case empty(Int)

        var id: String {
            switch self {
            case .player(let p): return "p-\(p.seatIndex)"
            case .empty(let i): return "e-\(i)"
            }
        }

        var seatIndex: Int {
            switch self {
            case .player(let p): return p.seatIndex
            case .empty(let i): return i
            }
        }
    }

    var body: some View {
        let items: [SeatItem] = (
            opponents.map { .player($0) } +
            emptySeats.map { .empty($0) }
        ).sorted { $0.seatIndex < $1.seatIndex }

        let row1 = Array(items.prefix(5))
        let row2 = Array(items.dropFirst(5))
        let row2Left = Array(row2.prefix(row2.count / 2 + row2.count % 2))
        let row2Right = Array(row2.dropFirst(row2Left.count))

        VStack(spacing: 2) {
            // Row 1
            HStack(spacing: 0) {
                ForEach(row1) { item in
                    renderItem(item)
                        .frame(maxWidth: .infinity)
                }
            }

            // Row 2 with center gap
            if !row2.isEmpty {
                // Row 2: same 5 equal columns as row 1; column 2 (center) is the "your seat" gap
                HStack(spacing: 0) {
                    // Columns 0 & 1
                    ForEach(0..<2, id: \.self) { i in
                        Group {
                            if i < row2Left.count {
                                renderItem(row2Left[i])
                            } else {
                                Color.clear
                            }
                        }
                        .frame(maxWidth: .infinity)
                    }

                    // Column 2: your seat gap (same flex-1 as other columns)
                    Color.clear.frame(maxWidth: .infinity)

                    // Columns 3 & 4
                    ForEach(0..<2, id: \.self) { i in
                        Group {
                            if i < row2Right.count {
                                renderItem(row2Right[i])
                            } else {
                                Color.clear
                            }
                        }
                        .frame(maxWidth: .infinity)
                    }
                }
            }
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 4)
    }

    @ViewBuilder
    private func renderItem(_ item: SeatItem) -> some View {
        switch item {
        case .player(let p):
            PlayerBubbleView(
                player: p,
                isDealer: p.seatIndex == dealerSeatIndex,
                isSmallBlind: p.seatIndex == smallBlindIndex,
                isBigBlind: p.seatIndex == bigBlindIndex
            )
        case .empty(let seat):
            EmptySeatBubbleView(seatIndex: seat) {
                onEmptySeatTap?(seat)
            }
        }
    }
}
