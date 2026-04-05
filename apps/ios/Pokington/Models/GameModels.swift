import Foundation

// MARK: - Card primitives (mirrors @pokington/shared)

enum Rank: String, Codable, CaseIterable {
    case two = "2", three = "3", four = "4", five = "5"
    case six = "6", seven = "7", eight = "8", nine = "9"
    case ten = "T", jack = "J", queen = "Q", king = "K", ace = "A"

    var display: String {
        self == .ten ? "10" : rawValue
    }
}

enum Suit: String, Codable, CaseIterable {
    case spades, hearts, diamonds, clubs

    var symbol: String {
        switch self {
        case .spades:   return "♠"
        case .hearts:   return "♥"
        case .diamonds: return "♦"
        case .clubs:    return "♣"
        }
    }

    var isRed: Bool {
        self == .hearts || self == .diamonds
    }
}

struct Card: Codable, Identifiable {
    let rank: Rank
    let suit: Suit
    var id: String { "\(rank.rawValue)\(suit.rawValue)" }
}

// MARK: - Game state

enum GamePhase: String, Codable {
    case waiting
    case preFlop = "pre-flop"
    case flop, turn, river, showdown
}

enum LastAction: String, Codable {
    case fold, check, call, raise
    case allIn = "all-in"
}

struct PublicPlayerState: Codable, Identifiable {
    let id: String
    let name: String
    let seatIndex: Int
    let stack: Int          // integer cents
    let isFolded: Bool
    let isCurrentActor: Bool
    let lastAction: LastAction?
    let cardCount: Int      // 0 or 2
}

struct PrivateStatePayload: Codable {
    let holeCards: [Card]?      // exactly 2 when present
    let handStrength: String?   // "Flush", "Two Pair", etc.
}

struct Blinds: Codable {
    let small: Int
    let big: Int
}

struct TableStatePayload: Codable {
    let tableName: String
    let handNumber: Int
    let phase: GamePhase
    let players: [String: PublicPlayerState]
    let communityCards: [Card]
    let pot: Int            // integer cents
    let blinds: Blinds
    let dealerSeatIndex: Int
}
