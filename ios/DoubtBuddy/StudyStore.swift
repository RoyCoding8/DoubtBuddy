import Foundation
import Security

private struct StudySnapshot: Codable {
    var doubts: [Doubt] = []
    var attempts: [PracticeAttempt] = []
}

enum KeyVault {
    static let service = "dev.doubtbuddy.ios"
    static let account = "gemini-api-key"

    static func get() -> String? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne
        ]
        var result: CFTypeRef?
        guard SecItemCopyMatching(query as CFDictionary, &result) == errSecSuccess,
              let data = result as? Data else { return nil }
        return String(data: data, encoding: .utf8)
    }

    static func save(_ value: String) {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account
        ]
        SecItemDelete(query as CFDictionary)
        guard !value.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return }
        var update = query
        update[kSecValueData as String] = Data(value.trimmingCharacters(in: .whitespacesAndNewlines).utf8)
        update[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
        SecItemAdd(update as CFDictionary, nil)
    }
}

enum GeminiService {
    static func solve(key: String, subject: Subject, mode: SolveMode, question: String,
                      image: Data? = nil, mimeType: String = "image/jpeg") async throws -> String {
        let prompt = "You are DoubtBuddy, a careful JEE tutor for " + subject.label + ". " + mode.instruction +
            " Check calculations, do not invent facts, say when uncertain, and use plain text equations."
        var parts: [[String: Any]] = [["text": question]]
        if let image {
            parts.append(["inline_data": ["mime_type": mimeType, "data": image.base64EncodedString()]])
        }
        let payload: [String: Any] = [
            "systemInstruction": ["parts": [["text": prompt]]],
            "contents": [["role": "user", "parts": parts]],
            "generationConfig": ["maxOutputTokens": 2048]
        ]
        let url = URL(string: "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.timeoutInterval = 60
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue(key, forHTTPHeaderField: "x-goog-api-key")
        request.httpBody = try JSONSerialization.data(withJSONObject: payload)
        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse else { throw StudyError.message("No network response.") }
        guard 200...299 ~= http.statusCode else {
            let message: String
            switch http.statusCode {
            case 400: message = "Question could not be processed. Try a shorter question or smaller image."
            case 401, 403: message = "API key rejected. Check your Gemini key in Settings."
            case 429: message = "Gemini rate limit reached. Try again shortly."
            case 500...599: message = "Gemini is temporarily unavailable."
            default: message = "Gemini request failed. HTTP " + String(http.statusCode)
            }
            throw StudyError.message(message)
        }
        let json = try JSONSerialization.jsonObject(with: data) as? [String: Any]
        let candidates = json?["candidates"] as? [[String: Any]]
        let content = candidates?.first?["content"] as? [String: Any]
        let answerParts = content?["parts"] as? [[String: Any]]
        let answer = (answerParts ?? []).compactMap { $0["text"] as? String }.joined().trimmingCharacters(in: .whitespacesAndNewlines)
        guard !answer.isEmpty else { throw StudyError.message("No answer returned. Try rephrasing.") }
        return answer
    }
}

enum StudyError: LocalizedError {
    case message(String)
    var errorDescription: String? {
        if case let .message(text) = self { text } else { nil }
    }
}

@MainActor
final class StudyStore: ObservableObject {
    @Published private(set) var doubts: [Doubt] = []
    @Published private(set) var attempts: [PracticeAttempt] = []
    @Published private(set) var solveStatus: SolveStatus = .idle
    @Published private(set) var hasKey = false

    private let fileURL: URL

    init() {
        let folder = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        try? FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        fileURL = folder.appendingPathComponent("study.json")
        if let data = try? Data(contentsOf: fileURL),
           let snapshot = try? JSONDecoder().decode(StudySnapshot.self, from: data) {
            doubts = snapshot.doubts.sorted { $0.createdAt > $1.createdAt }
            attempts = snapshot.attempts.sorted { $0.completedAt > $1.completedAt }
        }
        hasKey = !(KeyVault.get() ?? "").isEmpty
    }

    private func persist() {
        let snapshot = StudySnapshot(doubts: doubts, attempts: attempts)
        if let data = try? JSONEncoder().encode(snapshot) {
            try? data.write(to: fileURL, options: .atomic)
        }
    }

    func saveKey(_ key: String) {
        KeyVault.save(key)
        hasKey = !(KeyVault.get() ?? "").isEmpty
    }

    func clearAnswer() {
        if solveStatus != .loading { solveStatus = .idle }
    }

    func solve(subject: Subject, mode: SolveMode, question: String, image: Data? = nil, mimeType: String = "image/jpeg") {
        let trimmed = question.trimmingCharacters(in: .whitespacesAndNewlines)
        guard solveStatus != .loading else { return }
        guard !trimmed.isEmpty || image != nil else {
            solveStatus = .failure("Enter a question or attach an image.")
            return
        }
        guard trimmed.count <= 6000 else {
            solveStatus = .failure("Keep questions under 6,000 characters.")
            return
        }
        solveStatus = .loading
        Task {
            do {
                let key = KeyVault.get()
                let sample = (key ?? "").isEmpty
                let answer: String
                if let key, !key.isEmpty {
                    answer = try await GeminiService.solve(key: key, subject: subject, mode: mode,
                        question: trimmed.isEmpty ? "Solve the attached question." : trimmed,
                        image: image, mimeType: mimeType)
                } else {
                    answer = "Local preview only. This is not an AI-generated solution.\n\n" +
                        "For " + subject.label.lowercased() + ", identify the given information and what is asked. " +
                        "Start with the relevant principle or formula before substituting values.\n\n" +
                        "Add your Gemini API key in Settings for a worked solution."
                }
                doubts.insert(Doubt(id: UUID(), subject: subject, question: trimmed.isEmpty ? "Image question" : trimmed,
                    answer: answer, mode: mode, createdAt: Date(), isSample: sample), at: 0)
                persist()
                solveStatus = .answer(answer, sample: sample)
            } catch {
                solveStatus = .failure(error.localizedDescription)
            }
        }
    }

    func toggleBookmark(_ id: UUID) {
        guard let index = doubts.firstIndex(where: { $0.id == id }) else { return }
        doubts[index].bookmarked.toggle()
        persist()
    }

    func deleteDoubt(_ id: UUID) {
        doubts.removeAll { $0.id == id }
        persist()
    }

    func record(_ question: PracticeQuestion, selected: Int, review: Bool = false) {
        guard question.choices.indices.contains(selected) else { return }
        let now = Date()
        let correct = question.correct == selected
        let delay: TimeInterval = correct ? (review ? 3 * 86400 : 86400) : (review ? 600 : 0)
        attempts.insert(PracticeAttempt(id: UUID(), questionId: question.id, subject: question.subject,
            chapter: question.chapter, selected: selected, correct: correct,
            completedAt: now, nextReviewAt: now.addingTimeInterval(delay)), at: 0)
        persist()
    }
}
