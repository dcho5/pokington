import SwiftUI

struct CreateTableView: View {
    let onConfirm: () -> Void

    @Environment(\.colorScheme) private var colorScheme

    @State private var tableName = ""
    @State private var blindIdx = 0
    @State private var bountyIdx = 0
    @FocusState private var nameFocused: Bool

    private let blindOptions = ["10¢ / 25¢", "25¢ / 50¢", "50¢ / $1", "$1 / $2"]
    private let bountyOptions = ["Off", "1x BB", "2x BB", "3x BB", "4x BB", "5x BB"]

    var body: some View {
        VStack(alignment: .leading, spacing: 22) {

            // Table name
            TextField("Table name (optional)", text: $tableName)
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
                            nameFocused ? Color.red.opacity(0.6) : Color(hex: 0x374151),
                            lineWidth: 1.5
                        )
                )
                .focused($nameFocused)

            // Blinds
            VStack(alignment: .leading, spacing: 6) {
                Text("Blinds")
                    .font(.caption)
                    .foregroundColor(.gray)
                SegmentedPicker(options: blindOptions, selected: $blindIdx)
            }

            // Bounty
            VStack(alignment: .leading, spacing: 6) {
                Text("7-2 Offsuit Bounty")
                    .font(.caption)
                    .foregroundColor(.gray)
                PillPicker(options: bountyOptions, selected: $bountyIdx)
            }

            // Create button
            Button {
                onConfirm()
            } label: {
                Text("Create Table")
                    .modifier(PrimaryButtonStyle())
            }
            .buttonStyle(TactileButtonStyle())
        }
        .padding(24)
        .padding(.top, 8)
    }
}

// MARK: - Segmented Picker (tabs style — used for Blinds)

private struct SegmentedPicker: View {
    let options: [String]
    @Binding var selected: Int

    var body: some View {
        HStack(spacing: 2) {
            ForEach(options.indices, id: \.self) { i in
                Button {
                    withAnimation(.spring(response: 0.25, dampingFraction: 0.7)) { selected = i }
                } label: {
                    Text(options[i])
                        .font(.system(size: 11, weight: .medium))
                        .lineLimit(1)
                        .minimumScaleFactor(0.8)
                        .foregroundColor(selected == i ? .white : .gray)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 8)
                        .background(
                            RoundedRectangle(cornerRadius: 8, style: .continuous)
                                .fill(selected == i ? Color(hex: 0x1f2937) : .clear)
                                .shadow(color: selected == i ? .black.opacity(0.12) : .clear, radius: 4, y: 1)
                        )
                }
                .buttonStyle(.plain)
            }
        }
        .padding(4)
        .background(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .fill(Color(hex: 0x0a0f1a))
        )
    }
}

// MARK: - Pill Picker (pills style — used for Bounty)

private struct PillPicker: View {
    let options: [String]
    @Binding var selected: Int

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 6) {
                pill(0); pill(1); pill(2)
            }
            HStack(spacing: 6) {
                pill(3); pill(4); pill(5)
            }
        }
    }

    @ViewBuilder
    private func pill(_ i: Int) -> some View {
        let active = selected == i
        let label = options[i]
        Button {
            withAnimation(.spring(response: 0.25, dampingFraction: 0.7)) { selected = i }
        } label: {
            Text(label)
                .font(.system(size: 12, weight: .medium))
                .foregroundColor(active ? .white : Color(hex: 0xe5e7eb))
                .padding(.horizontal, 14)
                .padding(.vertical, 7)
                .background(pillBackground(active: active))
                .overlay(Capsule().stroke(active ? Color.red.opacity(0.5) : .clear, lineWidth: 2))
        }
        .buttonStyle(TactileButtonStyle())
    }

    @ViewBuilder
    private func pillBackground(active: Bool) -> some View {
        if active {
            Capsule().fill(LinearGradient(
                colors: [.red, Color(hex: 0xb91c1c)],
                startPoint: .topLeading,
                endPoint: .bottomTrailing))
        } else {
            Capsule().fill(Color(hex: 0x1a2030))
        }
    }
}
