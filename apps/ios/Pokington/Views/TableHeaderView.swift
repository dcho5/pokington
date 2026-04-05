import SwiftUI

struct TableHeaderView: View {
    let tableName: String
    let smallBlind: Int
    let bigBlind: Int

    var body: some View {
        HStack {
            // Left: back chevron + table name (mirrors web "← TableName" combined button)
            Button(action: { /* nav back stub */ }) {
                HStack(spacing: 6) {
                    Image(systemName: "chevron.left")
                        .font(.system(size: 16, weight: .semibold))
                    Text(tableName)
                        .font(.system(size: 14, weight: .bold))
                        .lineLimit(1)
                }
                .foregroundColor(.white)
            }
            .frame(minWidth: 44, minHeight: 44, alignment: .leading)

            Spacer()

            // Center: animated poker chip logo — matches web TableHeader chip
            PokerChipView(size: 22, glowAngle: -45)

            Spacer()

            // Right: blinds
            Text("\(smallBlind.formattedAsCents) / \(bigBlind.formattedAsCents)")
                .font(.system(size: 12, weight: .medium, design: .monospaced))
                .foregroundColor(.gray)
                .frame(minWidth: 44, alignment: .trailing)
        }
        .padding(.horizontal, 8)
        .frame(height: 52)
        // Background extends behind the status bar (matches web header blur into notch)
        .background {
            Color(hex: 0x030712).opacity(0.85)
                .background(.ultraThinMaterial)
                .ignoresSafeArea(edges: .top)
        }
        .overlay(alignment: .bottom) {
            Rectangle()
                .fill(Color.white.opacity(0.06))
                .frame(height: 0.5)
        }
    }
}
