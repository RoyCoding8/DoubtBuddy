import Foundation

enum Subject: String, Codable, CaseIterable, Identifiable {
    case physics, chemistry, mathematics
    var id: String { rawValue }
    var label: String { rawValue.capitalized }
    var symbol: String { String(label.prefix(1)) }
}

enum SolveMode: String, Codable, CaseIterable, Identifiable {
    case guided, hint, concept, quick
    var id: String { rawValue }
    var label: String {
        switch self {
        case .guided: "Step by step"
        case .hint: "Just a hint"
        case .concept: "Explain concept"
        case .quick: "Quick answer"
        }
    }
    var instruction: String {
        switch self {
        case .guided: "Show clear numbered reasoning steps."
        case .hint: "Give one useful hint without the final answer."
        case .concept: "Explain the underlying principle with a short example."
        case .quick: "Answer concisely and include essential working."
        }
    }
}

struct Doubt: Identifiable, Codable {
    var id: UUID
    var subject: Subject
    var question: String
    var answer: String
    var mode: SolveMode
    var createdAt: Date
    var isSample: Bool
    var bookmarked: Bool = false
}

struct PracticeQuestion: Identifiable {
    let id: String
    let subject: Subject
    let chapter: String
    let text: String
    let choices: [String]
    let correct: Int
    let explanation: String
}

struct PracticeAttempt: Identifiable, Codable {
    let id: UUID
    let questionId: String
    let subject: Subject
    let chapter: String
    let selected: Int
    let correct: Bool
    let completedAt: Date
    let nextReviewAt: Date
}

enum SolveStatus: Equatable {
    case idle
    case loading
    case answer(String, sample: Bool)
    case failure(String)
}

enum QuestionBank {
    static let all: [PracticeQuestion] = [
        .init(id: "p01", subject: .physics, chapter: "Kinematics", text: "A car starts from rest and accelerates at 2 m/s². How far does it travel in 5 seconds?", choices: ["10 m", "20 m", "25 m", "50 m"], correct: 2, explanation: "s = ut + ½at² = 0 + ½ × 2 × 25 = 25 m."),
        .init(id: "p02", subject: .physics, chapter: "Newton's laws", text: "A net force of 12 N acts on a 3 kg body. Its acceleration is", choices: ["3 m/s²", "4 m/s²", "9 m/s²", "36 m/s²"], correct: 1, explanation: "Newton's second law gives a = F/m = 12/3 = 4 m/s²."),
        .init(id: "p03", subject: .physics, chapter: "Work and energy", text: "The kinetic energy of a 2 kg object moving at 3 m/s is", choices: ["3 J", "6 J", "9 J", "18 J"], correct: 2, explanation: "K = ½mv² = ½ × 2 × 9 = 9 J."),
        .init(id: "p04", subject: .physics, chapter: "Electricity", text: "Two resistors of 2 Ω and 3 Ω are in series. Equivalent resistance is", choices: ["1.2 Ω", "2.5 Ω", "5 Ω", "6 Ω"], correct: 2, explanation: "Series resistances add: 2 + 3 = 5 Ω."),
        .init(id: "p05", subject: .physics, chapter: "Optics", text: "A plane mirror produces an image that is", choices: ["Real and inverted", "Virtual and erect", "Real and erect", "Always magnified"], correct: 1, explanation: "A plane mirror produces a virtual, erect image of the same size."),
        .init(id: "p06", subject: .physics, chapter: "Waves", text: "A frequency of 50 Hz corresponds to a period of", choices: ["0.02 s", "0.2 s", "2 s", "50 s"], correct: 0, explanation: "T = 1/f = 1/50 = 0.02 s."),
        .init(id: "c01", subject: .chemistry, chapter: "Mole concept", text: "How many moles are in 18 g of water (molar mass 18 g/mol)?", choices: ["0.5 mol", "1 mol", "2 mol", "18 mol"], correct: 1, explanation: "Moles = mass/molar mass = 18/18 = 1."),
        .init(id: "c02", subject: .chemistry, chapter: "Atomic structure", text: "The maximum number of electrons in the n = 2 shell is", choices: ["2", "4", "8", "18"], correct: 2, explanation: "Capacity = 2n² = 2 × 2² = 8."),
        .init(id: "c03", subject: .chemistry, chapter: "Periodic trends", text: "The most electronegative element is", choices: ["Fluorine", "Chlorine", "Oxygen", "Nitrogen"], correct: 0, explanation: "Fluorine has the highest electronegativity on the Pauling scale."),
        .init(id: "c04", subject: .chemistry, chapter: "Chemical bonding", text: "A bond formed by sharing electron pairs is", choices: ["Ionic", "Metallic", "Covalent", "Hydrogen"], correct: 2, explanation: "Covalent bonds form through shared electron pairs."),
        .init(id: "c05", subject: .chemistry, chapter: "Acids and bases", text: "At 25 °C, neutral water has pH", choices: ["0", "7", "10", "14"], correct: 1, explanation: "At 25 °C, [H+] = 10⁻⁷ mol/L and pH = 7."),
        .init(id: "c06", subject: .chemistry, chapter: "Organic chemistry", text: "The functional group in ethanol is", choices: ["Carboxyl", "Hydroxyl", "Aldehyde", "Ketone"], correct: 1, explanation: "Ethanol contains the hydroxyl -OH group."),
        .init(id: "m01", subject: .mathematics, chapter: "Quadratics", text: "The roots of x² − 5x + 6 = 0 are", choices: ["1 and 6", "−2 and −3", "2 and 3", "−1 and −6"], correct: 2, explanation: "Factor (x − 2)(x − 3) = 0."),
        .init(id: "m02", subject: .mathematics, chapter: "Calculus", text: "The derivative of x³ is", choices: ["x²", "2x", "3x²", "3x³"], correct: 2, explanation: "Use the power rule d(xⁿ)/dx = nxⁿ⁻¹."),
        .init(id: "m03", subject: .mathematics, chapter: "Trigonometry", text: "sin² θ + cos² θ equals", choices: ["0", "1", "2", "sin 2θ"], correct: 1, explanation: "The Pythagorean identity equals 1."),
        .init(id: "m04", subject: .mathematics, chapter: "Probability", text: "A fair coin is tossed twice. Probability of two heads is", choices: ["1/2", "1/3", "1/4", "3/4"], correct: 2, explanation: "One of four outcomes is HH."),
        .init(id: "m05", subject: .mathematics, chapter: "Sequences", text: "The 5th term of the AP 3, 7, 11, ... is", choices: ["15", "17", "19", "23"], correct: 2, explanation: "a₅ = 3 + 4 × 4 = 19."),
        .init(id: "m06", subject: .mathematics, chapter: "Coordinate geometry", text: "Distance between (0,0) and (3,4) is", choices: ["3", "4", "5", "7"], correct: 2, explanation: "√(3² + 4²) = 5.")
    ]
    static func forSubject(_ subject: Subject) -> [PracticeQuestion] {
        all.filter { $0.subject == subject }
    }
    static func find(_ id: String) -> PracticeQuestion? {
        all.first { $0.id == id }
    }
}

enum StudyStats {
    static func accuracy(_ attempts: [PracticeAttempt]) -> Int {
        attempts.isEmpty ? 0 : attempts.filter(\.correct).count * 100 / attempts.count
    }
    static func due(_ attempts: [PracticeAttempt], now: Date = Date()) -> [PracticeAttempt] {
        Dictionary(grouping: attempts, by: \.questionId).values
            .compactMap { $0.max(by: { $0.completedAt < $1.completedAt }) }
            .filter { $0.nextReviewAt <= now }
            .sorted { $0.nextReviewAt < $1.nextReviewAt }
    }
}
