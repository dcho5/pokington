import SwiftUI

// Deterministic avatar color — same hash as web PlayerBubble.tsx
enum AvatarColor {
    private static let palette: [Color] = [
        Color(hex: 0x1a3a5c),
        Color(hex: 0x3a1a5c),
        Color(hex: 0x1a5c3a),
        Color(hex: 0x5c3a1a),
        Color(hex: 0x5c1a3a),
        Color(hex: 0x3a5c1a),
    ]

    static func color(for name: String) -> Color {
        var hash: Int32 = 0
        for c in name.utf8 {
            hash = hash &* 31 &+ Int32(c)
        }
        let idx = Int(abs(hash)) % palette.count
        return palette[idx]
    }

    static func initials(for name: String) -> String {
        let parts = name.trimmingCharacters(in: .whitespaces)
            .split(separator: " ")
        if parts.count >= 2,
           let a = parts[0].first, let b = parts[1].first {
            return "\(a)\(b)".uppercased()
        }
        return String(name.prefix(2)).uppercased()
    }
}

// MARK: - Hex color helper

extension Color {
    init(hex: UInt32, alpha: Double = 1.0) {
        self.init(
            .sRGB,
            red: Double((hex >> 16) & 0xFF) / 255,
            green: Double((hex >> 8) & 0xFF) / 255,
            blue: Double(hex & 0xFF) / 255,
            opacity: alpha
        )
    }
}
