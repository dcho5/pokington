import SwiftUI
import Combine

@MainActor
final class GameViewModel: ObservableObject {

    // MARK: - Published state

    @Published var tableName = "Demo Table"
    @Published var phase: GamePhase = .flop
    @Published var handNumber = 1
    @Published var blinds = Blinds(small: 10, big: 25)
    @Published var pot = 4500              // cents
    @Published var dealerSeatIndex = 1

    @Published var communityCards: [Card] = [
        Card(rank: .ace, suit: .spades),
        Card(rank: .king, suit: .hearts),
        Card(rank: .queen, suit: .diamonds),
    ]

    @Published var holeCards: [Card]? = [
        Card(rank: .jack, suit: .clubs),
        Card(rank: .ten, suit: .spades),
    ]
    @Published var handStrength: String? = "Straight"

    @Published var players: [Int: PublicPlayerState] = {
        var dict = [Int: PublicPlayerState]()
        dict[1] = PublicPlayerState(id: "p1", name: "Alice",   seatIndex: 1, stack: 15000, isFolded: false, isCurrentActor: true,  lastAction: .raise, cardCount: 2)
        dict[3] = PublicPlayerState(id: "p2", name: "Bob",     seatIndex: 3, stack: 8500,  isFolded: false, isCurrentActor: false, lastAction: .call,  cardCount: 2)
        dict[5] = PublicPlayerState(id: "me", name: "You",     seatIndex: 5, stack: 12000, isFolded: false, isCurrentActor: false, lastAction: nil,    cardCount: 2)
        dict[7] = PublicPlayerState(id: "p3", name: "Charlie", seatIndex: 7, stack: 22000, isFolded: false, isCurrentActor: false, lastAction: .check, cardCount: 2)
        return dict
    }()

    @Published var myPlayerId = "me"

    // MARK: - Derived

    var myPlayer: PublicPlayerState? {
        players.values.first { $0.id == myPlayerId }
    }

    var opponents: [PublicPlayerState] {
        players.values
            .filter { $0.id != myPlayerId }
            .sorted { $0.seatIndex < $1.seatIndex }
    }

    var isMyTurn: Bool {
        myPlayer?.isCurrentActor ?? false
    }

    var currentActorName: String? {
        players.values.first { $0.isCurrentActor && $0.id != myPlayerId }?.name
    }

    var smallBlindIndex: Int? { (dealerSeatIndex + 1) % 10 }
    var bigBlindIndex: Int? { (dealerSeatIndex + 2) % 10 }

    // MARK: - Actions (stubs — print to console)

    func fold() {
        print("[Action] Fold")
    }

    func call() {
        print("[Action] Call \(blinds.big)")
    }

    func raise(to amount: Int) {
        print("[Action] Raise to \(amount)")
    }

    func sitDown(seat: Int, name: String, buyInCents: Int = 0) {
        print("[Action] Sit down at seat \(seat) as \(name) with buy-in \(buyInCents.formattedAsCents)")
    }
}
