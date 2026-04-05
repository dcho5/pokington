import SwiftUI

// MARK: - Raise Sheet

struct RaiseSheetView: View {
    let pot: Int
    let stack: Int
    let minRaise: Int
    let onConfirm: (Int) -> Void
    let onDismiss: () -> Void

    @State private var amount: Int

    init(pot: Int, stack: Int, minRaise: Int, onConfirm: @escaping (Int) -> Void, onDismiss: @escaping () -> Void) {
        self.pot = pot
        self.stack = stack
        self.minRaise = minRaise
        self.onConfirm = onConfirm
        self.onDismiss = onDismiss
        _amount = State(initialValue: min(max(pot, minRaise), stack))
    }

    var body: some View {
        VStack(spacing: 20) {
            // Handle
            Capsule()
                .fill(Color.gray.opacity(0.4))
                .frame(width: 40, height: 4)
                .padding(.top, 12)

            // Amount
            Text(amount.formattedAsCents)
                .font(.system(size: 30, weight: .black, design: .monospaced))
                .foregroundColor(.white)

            // +/- controls
            HStack(spacing: 32) {
                stepButton("−") {
                    amount = max(minRaise, amount - minRaise)
                    UIImpactFeedbackGenerator(style: .light).impactOccurred()
                }
                stepButton("+") {
                    amount = min(stack, amount + minRaise)
                    UIImpactFeedbackGenerator(style: .light).impactOccurred()
                }
            }

            // Presets
            HStack(spacing: 8) {
                presetButton("½ Pot", value: pot / 2)
                presetButton("Pot", value: pot)
                presetButton("All-in", value: stack)
            }

            // Confirm
            Button {
                UIImpactFeedbackGenerator(style: .medium).impactOccurred()
                onConfirm(amount)
                onDismiss()
            } label: {
                Text("Raise to \(amount.formattedAsCents)")
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
        }
        .padding(.horizontal, 16)
        .padding(.bottom, 16)
        .background {
            Color(hex: 0x030712).opacity(0.95)
                .background(.ultraThinMaterial)
                .clipShape(.rect(
                    topLeadingRadius: 24,
                    bottomLeadingRadius: 0,
                    bottomTrailingRadius: 0,
                    topTrailingRadius: 24,
                    style: .continuous
                ))
                .ignoresSafeArea(edges: .bottom)
        }
    }

    private func stepButton(_ label: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(label)
                .font(.system(size: 22, weight: .bold))
                .foregroundColor(.white)
                .frame(width: 48, height: 48)
                .background(Color(hex: 0x1f2937))
                .clipShape(Circle())
        }
    }

    private func presetButton(_ label: String, value: Int) -> some View {
        Button {
            amount = min(max(value, minRaise), stack)
            UIImpactFeedbackGenerator(style: .light).impactOccurred()
        } label: {
            Text(label)
                .font(.system(size: 12, weight: .bold))
                .foregroundColor(.gray)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 10)
                .background(Color(hex: 0x1f2937))
                .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
        }
    }
}

// MARK: - Action Bar

struct ActionBarView: View {
    let isYourTurn: Bool
    let waitingFor: String?
    let callAmount: Int
    let pot: Int
    let stack: Int
    let minRaise: Int
    let onFold: () -> Void
    let onCall: () -> Void
    let onRaise: (Int) -> Void

    @State private var showRaiseSheet = false
    /// Drives the 30-second countdown timer bar (1.0 = full, 0.0 = empty).
    @State private var timerProgress: CGFloat = 1.0

    var body: some View {
        VStack(spacing: 0) {
            Rectangle()
                .fill(Color.white.opacity(0.06))
                .frame(height: 0.5)

            VStack(spacing: 8) {
                // Waiting-for label
                if !isYourTurn, let name = waitingFor {
                    Text("Waiting for \(name)…")
                        .font(.system(size: 12))
                        .foregroundColor(.gray)
                }

                // Timer bar — animates 100% → 0% over 30s when it's your turn
                if isYourTurn {
                    GeometryReader { geo in
                        ZStack(alignment: .leading) {
                            // Track
                            Capsule()
                                .fill(Color.white.opacity(0.08))
                                .frame(width: geo.size.width, height: 4)
                            // Fill
                            Capsule()
                                .fill(
                                    LinearGradient(
                                        colors: [.red, Color(hex: 0xb91c1c)],
                                        startPoint: .leading,
                                        endPoint: .trailing
                                    )
                                )
                                .frame(width: geo.size.width * timerProgress, height: 4)
                        }
                    }
                    .frame(height: 4)
                    .onAppear {
                        // Reset and start 30-second countdown each time the bar appears
                        timerProgress = 1.0
                        withAnimation(.linear(duration: 30)) {
                            timerProgress = 0.0
                        }
                    }
                }

                // Action buttons
                HStack(spacing: 8) {
                    // Fold
                    Button {
                        UIImpactFeedbackGenerator(style: .light).impactOccurred()
                        onFold()
                    } label: {
                        Text("Fold")
                            .font(.system(size: 18, weight: .bold))
                            .foregroundColor(.white)
                            .frame(maxWidth: .infinity)
                            .frame(height: 56)
                            .background(Color.white.opacity(0.08))
                            .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                    }

                    // Call
                    Button {
                        UIImpactFeedbackGenerator(style: .light).impactOccurred()
                        onCall()
                    } label: {
                        Text("Call \(callAmount.formattedAsCents)")
                            .font(.system(size: 18, weight: .bold))
                            .foregroundColor(.white)
                            .frame(maxWidth: .infinity)
                            .frame(height: 56)
                            .background(Color.white.opacity(0.12))
                            .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                    }

                    // Raise
                    Button {
                        UIImpactFeedbackGenerator(style: .medium).impactOccurred()
                        showRaiseSheet = true
                    } label: {
                        Text("Raise ↑")
                            .font(.system(size: 18, weight: .black))
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
                            .shadow(color: .red.opacity(0.4), radius: 12)
                    }
                }
                .opacity(isYourTurn ? 1 : 0.4)
                .disabled(!isYourTurn)
            }
            .padding(.horizontal, 16)
            .padding(.top, 12)
            .padding(.bottom, 12)
        }
        // Background extends into home indicator zone (matches web's paddingBottom safe area)
        .background {
            Color(hex: 0x030712).opacity(0.95)
                .background(.ultraThinMaterial)
                .ignoresSafeArea(edges: .bottom)
        }
        .sheet(isPresented: $showRaiseSheet) {
            RaiseSheetView(
                pot: pot,
                stack: stack,
                minRaise: minRaise,
                onConfirm: onRaise,
                onDismiss: { showRaiseSheet = false }
            )
            .presentationDetents([.medium])
            .presentationDragIndicator(.hidden)
            .presentationBackground(.ultraThinMaterial)
        }
    }
}
