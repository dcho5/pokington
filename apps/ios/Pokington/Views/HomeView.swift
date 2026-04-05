import SwiftUI

struct HomeView: View {
    @Environment(\.horizontalSizeClass) private var sizeClass
    @Environment(\.colorScheme) private var colorScheme

    @State private var animate = false
    @State private var glowPulse = false
    @State private var floatUp = false

    @State private var showCreate = false
    @State private var showJoin = false
    @State private var showTable = false

    private var isWideLayout: Bool { sizeClass == .regular }

    var body: some View {
        ZStack {
            ZStack {
                backgroundView

                Circle()
                    .fill(Color.red.opacity(glowPulse ? 0.18 : 0.12))
                    .frame(width: 800, height: 800)
                    .blur(radius: 150)
                    .offset(y: -100)
                    .animation(.easeInOut(duration: 4).repeatForever(autoreverses: true), value: glowPulse)
            }
            .ignoresSafeArea()

            VStack(spacing: 0) {
                Spacer()

                header
                    .opacity(animate ? 1 : 0)
                    .offset(y: animate ? 0 : 20)

                Spacer()

                VStack(spacing: 12) {
                    createButton
                    joinButton
                }
                .frame(maxWidth: 340)
                .opacity(animate ? 1 : 0)
                .offset(y: animate ? 0 : 15)

                Spacer()
            }
            .padding(.horizontal, 24)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .safeAreaInset(edge: .bottom) {
            Text("Pokington © 2026. Texas Hold'em for web and mobile.")
                .font(.caption2)
                .foregroundColor(.gray.opacity(0.5))
                .padding(.bottom, 10)
                .opacity(animate ? 1 : 0)
        }
        .onAppear {
            withAnimation(.spring(response: 0.7, dampingFraction: 0.8)) {
                animate = true
            }
            glowPulse = true
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.9) {
                floatUp = true
            }
        }
        .sheet(isPresented: $showCreate) {
            CreateTableView(onConfirm: {
                showCreate = false
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.35) {
                    showTable = true
                }
            })
            .presentationDetents([.medium])
            .presentationDragIndicator(.visible)
            .presentationBackground(Color(hex: 0x0d1117))
        }
        .sheet(isPresented: $showJoin) {
            JoinTableView(onConfirm: {
                showJoin = false
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.35) {
                    showTable = true
                }
            })
            .presentationDetents([.height(200)])
            .presentationDragIndicator(.visible)
            .presentationBackground(Color(hex: 0x0d1117))
        }
        .fullScreenCover(isPresented: $showTable) {
            NavigationStack {
                TableView()
            }
        }
    }

    // MARK: - Header
    private var header: some View {
        VStack(spacing: 12) {
            Text("♠ ♥ ♦ ♣")
                .font(.title3)
                .tracking(6)
                .foregroundColor(.gray.opacity(0.7))
                .offset(y: floatUp ? -3 : 3)
                .animation(.easeInOut(duration: 3).repeatForever(autoreverses: true), value: floatUp)

            HStack(spacing: 6) {
                Text("Pokington")
                    .font(.system(size: 34, weight: .bold))

                PokerChipView(size: 40)
            }

            Text("Real-time multiplayer Texas Hold'em")
                .font(.system(size: 16))
                .foregroundColor(.gray)
                .opacity(animate ? 1 : 0)
        }
    }

    // MARK: - Buttons
    private var createButton: some View {
        Button { showCreate = true } label: {
            Text("Create Table")
                .modifier(PrimaryButtonStyle())
        }
        .buttonStyle(TactileButtonStyle())
    }

    private var joinButton: some View {
        Button { showJoin = true } label: {
            Text("Join Table")
                .modifier(PrimaryButtonStyle())
        }
        .buttonStyle(TactileButtonStyle())
    }

    // MARK: - Background
    private var backgroundView: some View {
        LinearGradient(
            colors: colorScheme == .dark
                ? [Color(hex: 0x030712), .black]
                : [Color(hex: 0xf3f4f6), Color(hex: 0xe5e7eb)],
            startPoint: .top,
            endPoint: .bottom
        )
    }
}

// MARK: - Styles
struct TactileButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? 0.96 : 1.0)
            .animation(.spring(response: 0.25, dampingFraction: 0.6), value: configuration.isPressed)
    }
}

struct PrimaryButtonStyle: ViewModifier {
    func body(content: Content) -> some View {
        content
            .font(.system(size: 17, weight: .semibold))
            .foregroundColor(.white)
            .frame(maxWidth: .infinity)
            .frame(height: 50)
            .background(
                LinearGradient(
                    colors: [Color.red, Color(hex: 0xb91c1c)],
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                )
            )
            .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
            .shadow(color: .red.opacity(0.25), radius: 16, y: 4)
    }
}
