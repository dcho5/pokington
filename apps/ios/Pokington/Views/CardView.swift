import SwiftUI

struct CardView: View {
    let card: Card?

    var body: some View {
        if let card {
            faceUp(card)
        } else {
            faceDown
        }
    }

    // MARK: - Face-up

    private func faceUp(_ card: Card) -> some View {
        let color: Color = card.suit.isRed ? .red : .primary
        return ZStack {
            RoundedRectangle(cornerRadius: 8)
                .fill(.white)
                .overlay(
                    RoundedRectangle(cornerRadius: 8)
                        .stroke(Color.gray.opacity(0.25), lineWidth: 1)
                )

            VStack {
                // Top-left
                HStack(spacing: 1) {
                    Text(card.rank.display)
                    Text(card.suit.symbol)
                }
                .font(.system(size: 11, weight: .bold))
                .foregroundColor(color)
                .frame(maxWidth: .infinity, alignment: .leading)

                Spacer()

                // Center suit
                Text(card.suit.symbol)
                    .font(.system(size: 22))
                    .foregroundColor(color)

                Spacer()

                // Bottom-right (rotated)
                HStack(spacing: 1) {
                    Text(card.rank.display)
                    Text(card.suit.symbol)
                }
                .font(.system(size: 11, weight: .bold))
                .foregroundColor(color)
                .frame(maxWidth: .infinity, alignment: .trailing)
                .rotationEffect(.degrees(180))
            }
            .padding(6)
        }
        .shadow(color: .black.opacity(0.35), radius: 8, y: 4)
    }

    // MARK: - Face-down (white frame + dark blue gradient inner — looks like a real card back)

    private var faceDown: some View {
        ZStack {
            // White card frame
            RoundedRectangle(cornerRadius: 8)
                .fill(Color.white)

            // Dark blue gradient inner
            RoundedRectangle(cornerRadius: 5)
                .fill(
                    LinearGradient(
                        colors: [Color(hex: 0x1e3a5f), Color(hex: 0x0f2040), Color(hex: 0x1a3356)],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                )
                .padding(4)
                .overlay(
                    GeometryReader { geo in
                        // Crosshatch grid lines
                        ZStack {
                            // Horizontal lines
                            Path { path in
                                var y: CGFloat = 4
                                while y < geo.size.height {
                                    path.move(to: CGPoint(x: 4, y: y))
                                    path.addLine(to: CGPoint(x: geo.size.width - 4, y: y))
                                    y += 10
                                }
                            }
                            .stroke(Color.white.opacity(0.06), lineWidth: 1)

                            // Vertical lines
                            Path { path in
                                var x: CGFloat = 4
                                while x < geo.size.width {
                                    path.move(to: CGPoint(x: x, y: 4))
                                    path.addLine(to: CGPoint(x: x, y: geo.size.height - 4))
                                    x += 10
                                }
                            }
                            .stroke(Color.white.opacity(0.06), lineWidth: 1)
                        }
                    }
                    .padding(4)
                    .clipShape(RoundedRectangle(cornerRadius: 5))
                )
        }
        .shadow(color: .black.opacity(0.5), radius: 10, y: 5)
    }
}
