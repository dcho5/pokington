import SwiftUI

struct CommunityCardsView: View {
    let cards: [Card]
    let pot: Int

    @State private var appeared = false
    private let totalSlots = 5

    var body: some View {
        VStack(spacing: 8) {
            // Cards row — each card is flex-1 with 5:7 aspect ratio.
            // aspectRatio drives height from width, so no GeometryReader needed.
            HStack(spacing: 4) {
                ForEach(0..<totalSlots, id: \.self) { i in
                    CardView(card: i < cards.count ? cards[i] : nil)
                        .aspectRatio(5.0 / 7.0, contentMode: .fit)
                        .frame(maxWidth: .infinity)
                        // Staggered spring entrance from above — matches web motion stagger
                        .offset(y: appeared ? 0 : -40)
                        .opacity(appeared ? 1 : 0)
                        .animation(
                            .spring(response: 0.4, dampingFraction: 0.7)
                                .delay(Double(i) * 0.08),
                            value: appeared
                        )
                }
            }
            .padding(.horizontal, 8)

            // Pot display — fades and scales in after cards settle
            VStack(spacing: 4) {
                Text("TOTAL POT")
                    .font(.system(size: 10, weight: .black))
                    .tracking(2.5)
                    .foregroundColor(.gray.opacity(0.6))

                Text(pot.formattedAsCents)
                    .font(.system(size: 18, weight: .black, design: .monospaced))
                    .foregroundColor(.white)
                    .padding(.horizontal, 32)
                    .padding(.vertical, 10)
                    .background(
                        LinearGradient(
                            colors: [Color.red, Color(hex: 0xb91c1c)],
                            startPoint: .leading,
                            endPoint: .trailing
                        )
                    )
                    .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                    .shadow(color: .red.opacity(0.4), radius: 12)
            }
            .opacity(appeared ? 1 : 0)
            .scaleEffect(appeared ? 1 : 0.92)
            .animation(
                .spring(response: 0.4, dampingFraction: 0.75).delay(0.3),
                value: appeared
            )
        }
        .onAppear { appeared = true }
    }
}
