import SwiftUI

struct SplashView: View {
    @Environment(\.colorScheme) private var colorScheme

    @State private var showHome = false
    @State private var chipIn = false
    @State private var dismiss = false

    var body: some View {
        if showHome {
            HomeView()
                .transition(.opacity)
        } else {
            ZStack {
                splashBackground
                    .ignoresSafeArea()

                PokerChipView(size: 100)
                    .scaleEffect(dismiss ? 1.2 : (chipIn ? 1.0 : 0.6))
                    .opacity(dismiss ? 0 : (chipIn ? 1 : 0))
            }
            .onAppear { startSequence() }
        }
    }

    @ViewBuilder
    private var splashBackground: some View {
        if colorScheme == .dark {
            Color.black
        } else {
            LinearGradient(
                colors: [Color(hex: 0xd1d5db), Color(hex: 0xc4c9d1)],
                startPoint: .top,
                endPoint: .bottom
            )
        }
    }

    private func startSequence() {
        withAnimation(.spring(response: 0.6, dampingFraction: 0.7)) {
            chipIn = true
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 2.0) {
            withAnimation(.easeIn(duration: 0.35)) {
                dismiss = true
            }
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.4) {
                withAnimation(.easeOut(duration: 0.3)) {
                    showHome = true
                }
            }
        }
    }
}
