import SwiftUI
import UIKit

struct PracticeView: View {
    @EnvironmentObject private var store: StudyStore
    @State private var subject: Subject = .physics
    @State private var index = 0
    @State private var selection: Int?
    @State private var submitted = false

    private var question: PracticeQuestion { QuestionBank.forSubject(subject)[index % 6] }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                PageHeading(kicker: "Practice", title: "Build your confidence",
                            subtitle: "Quick concept checks with instant explanations.")
                SubjectPicker(selection: $subject)
                    .onChange(of: subject) { _, _ in index = 0; selection = nil; submitted = false }
                SoftCard {
                    Text(question.chapter.uppercased()).font(.caption.weight(.semibold)).foregroundStyle(accent)
                    Text("Question " + String(index + 1)).font(.caption).foregroundStyle(.secondary)
                    Text(question.text).font(.title3.weight(.medium))
                    ForEach(question.choices.indices, id: \.self) { number in
                        Button {
                            if !submitted { selection = number }
                        } label: {
                            Text(String(UnicodeScalar(65 + number)!) + ".  " + question.choices[number])
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .padding(15)
                                .background(selection == number ? accent.opacity(0.16) :
                                            Color(uiColor: .tertiarySystemFill),
                                            in: RoundedRectangle(cornerRadius: 14))
                        }
                        .buttonStyle(.plain)
                        .disabled(submitted)
                    }
                    if !submitted {
                        Button("Check answer") {
                            guard let selection else { return }
                            store.record(question, selected: selection)
                            submitted = true
                        }
                        .buttonStyle(.borderedProminent).tint(accent)
                        .disabled(selection == nil)
                        .frame(maxWidth: .infinity)
                    } else {
                        Divider()
                        Text(selection == question.correct ? "Correct" : "Keep learning")
                            .font(.headline).foregroundStyle(selection == question.correct ? accent : .red)
                        Text("Answer: " + question.choices[question.correct]).font(.headline)
                        Text(question.explanation)
                        Button("Next question") {
                            index += 1
                            selection = nil
                            submitted = false
                        }.buttonStyle(.borderedProminent).tint(accent)
                    }
                }
            }.padding(20)
        }
        .background(Color(uiColor: .systemGroupedBackground))
        .navigationTitle("DoubtBuddy")
        .navigationBarTitleDisplayMode(.inline)
    }
}

struct ReviewView: View {
    @EnvironmentObject private var store: StudyStore
    @State private var revealedFor: String?

    private var due: [PracticeAttempt] { StudyStats.due(store.attempts) }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                PageHeading(kicker: "Revise", title: "Make it stick",
                            subtitle: "Revisit mistakes and strengthen weak concepts.")
                if let first = due.first, let question = QuestionBank.find(first.questionId) {
                    SoftCard {
                        Text(String(due.count) + " due for review")
                            .font(.subheadline).foregroundStyle(accent)
                        Text(question.chapter).font(.caption)
                        Text(question.text).font(.title3.weight(.medium))
                        if revealedFor == question.id {
                            Text("Answer: " + question.choices[question.correct]).font(.headline)
                            Text(question.explanation)
                            HStack {
                                Button("Review again") {
                                    store.record(question, selected: (question.correct + 1) % 4, review: true)
                                    revealedFor = nil
                                }.buttonStyle(.bordered)
                                Spacer()
                                Button("Got it") {
                                    store.record(question, selected: question.correct, review: true)
                                    revealedFor = nil
                                }.buttonStyle(.borderedProminent).tint(accent)
                            }
                        } else {
                            Button("Reveal answer") { revealedFor = question.id }
                                .buttonStyle(.borderedProminent).tint(accent)
                        }
                    }
                } else {
                    SoftCard {
                        Text("You're all caught up").font(.title2.weight(.semibold))
                        Text("Questions you miss in Practice appear here. Correct answers come back for spaced review.")
                    }
                }
            }.padding(20)
        }
        .background(Color(uiColor: .systemGroupedBackground))
        .navigationTitle("DoubtBuddy")
        .navigationBarTitleDisplayMode(.inline)
        .onChange(of: due.first?.questionId) { _, _ in revealedFor = nil }
    }
}
