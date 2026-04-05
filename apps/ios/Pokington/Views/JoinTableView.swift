import SwiftUI

struct JoinTableView: View {
    let onConfirm: () -> Void

    @State private var tableCode = ""
    @FocusState private var codeFocused: Bool

    private var canJoin: Bool {
        !tableCode.trimmingCharacters(in: .whitespaces).isEmpty
    }

    var body: some View {
        VStack(spacing: 16) {
            HStack(spacing: 10) {
                TextField("Enter table code", text: $tableCode)
                    .autocapitalization(.allCharacters)
                    .autocorrectionDisabled()
                    .foregroundColor(.white)
                    .padding(12)
                    .background(
                        RoundedRectangle(cornerRadius: 10, style: .continuous)
                            .fill(Color(hex: 0x0a0f1a))
                    )
                    .overlay(
                        RoundedRectangle(cornerRadius: 10, style: .continuous)
                            .stroke(
                                codeFocused ? Color.red.opacity(0.6) : Color(hex: 0x374151),
                                lineWidth: 1.5
                            )
                    )
                    .focused($codeFocused)

                Button {
                    onConfirm()
                } label: {
                    Text("Join")
                        .font(.system(size: 17, weight: .semibold))
                        .foregroundColor(.white)
                        .padding(.horizontal, 22)
                        .frame(height: 46)
                        .background(
                            LinearGradient(
                                colors: [.red, Color(hex: 0xb91c1c)],
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            )
                        )
                        .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                        .shadow(color: .red.opacity(0.3), radius: 10, y: 3)
                }
                .buttonStyle(TactileButtonStyle())
                .disabled(!canJoin)
                .opacity(canJoin ? 1 : 0.5)
            }
        }
        .padding(24)
        .padding(.top, 8)
    }
}
