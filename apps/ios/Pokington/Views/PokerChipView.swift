import SwiftUI

struct PokerChipView: View {
    let size: CGFloat
    /// Degrees: 0 = right, 90 = down, 180/−180 = left, −90 = up
    let glowAngle: Double

    @Environment(\.colorScheme) private var colorScheme

    @State private var breathScale: CGFloat = 1.0
    @State private var animatedAngle: Double

    init(size: CGFloat = 38, glowAngle: Double = -45) {
        self.size = size
        self.glowAngle = glowAngle
        _animatedAngle = State(initialValue: glowAngle)
    }

    var body: some View {
        ZStack {
            // Ambient pulse ring
            Circle()
                .fill(
                    RadialGradient(
                        colors: [Color.red.opacity(0.18), Color.red.opacity(0)],
                        center: .center,
                        startRadius: 0,
                        endRadius: size * 0.6
                    )
                )
                .frame(width: size * 1.3, height: size * 1.3)

            // Rim
            Circle()
                .fill(Color(hex: colorScheme == .light ? 0xFFFFFF : 0x1f2937))
                .frame(width: size, height: size)

            // Red body
            Circle()
                .fill(
                    RadialGradient(
                        colors: [Color(hex: 0xbe1c1c), Color(hex: 0x7f1d1d)],
                        center: .center,
                        startRadius: 0,
                        endRadius: size * 0.4
                    )
                )
                .frame(width: size * 0.8, height: size * 0.8)

            // Specular glint — follows glowAngle
            let radians = animatedAngle * Double.pi / 180
            let orbit = size * 0.13
            Circle()
                .fill(
                    RadialGradient(
                        colors: [Color.white.opacity(0.55), Color.white.opacity(0)],
                        center: .center,
                        startRadius: 0,
                        endRadius: size * 0.23
                    )
                )
                .frame(width: size * 0.46, height: size * 0.46)
                .offset(
                    x: orbit * CGFloat(cos(radians)),
                    y: orbit * CGFloat(sin(radians))
                )
        }
        .scaleEffect(breathScale)
        .onAppear {
            breathScale = 1.04
        }
        // iOS 17+ two-parameter onChange form
        .onChange(of: glowAngle) { _, newAngle in
            withAnimation(.spring(response: 0.5, dampingFraction: 0.7)) {
                animatedAngle = newAngle
            }
        }
    }
}
