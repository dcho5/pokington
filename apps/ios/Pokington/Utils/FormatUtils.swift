import Foundation

extension Int {
    /// Formats integer cents as a dollar amount: 1050 → "$10.50"
    var formattedAsCents: String {
        String(format: "$%.2f", Double(self) / 100)
    }
}
