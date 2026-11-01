import SwiftUI
import PhotosUI
import UIKit

private enum Tab: Hashable {
    case ask, practice, review, progress, saved
}

private let accent = Color(red: 0.27, green: 0.36, blue: 0.63)

struct RootView: View {
    @State private var tab: Tab = .ask
    @State private var settings = false

    var body: some View {
        TabView(selection: $tab) {
            NavigationStack { AskView().toolbar { settingsButton } }
                .tabItem { Label("Ask", systemImage: "house") }.tag(Tab.ask)
            NavigationStack { PracticeView().toolbar { settingsButton } }
                .tabItem { Label("Practice", systemImage: "checkmark.circle") }.tag(Tab.practice)
            NavigationStack { ReviewView().toolbar { settingsButton } }
                .tabItem { Label("Review", systemImage: "clock") }.tag(Tab.review)
            NavigationStack { ProgressViewPage().toolbar { settingsButton } }
                .tabItem { Label("Progress", systemImage: "chart.bar") }.tag(Tab.progress)
            NavigationStack { SavedView().toolbar { settingsButton } }
                .tabItem { Label("Saved", systemImage: "books.vertical") }.tag(Tab.saved)
        }
        .tint(accent)
        .sheet(isPresented: $settings) {
            NavigationStack {
                SettingsView()
                    .toolbar {
                        ToolbarItem(placement: .topBarTrailing) {
                            Button("Done") { settings = false }
                        }
                    }
            }
            .tint(accent)
        }
    }

    private var settingsButton: some ToolbarContent {
        ToolbarItem(placement: .topBarTrailing) {
            Button { settings = true } label: { Image(systemName: "gearshape") }
                .accessibilityLabel("Settings")
        }
    }
}

private struct PageHeading: View {
    let kicker: String
    let title: String
    let subtitle: String

    var body: some View {
        VStack(alignment: .leading, spacing: 7) {
            Text(kicker.uppercased()).font(.caption.weight(.semibold)).foregroundStyle(accent)
            Text(title).font(.largeTitle.weight(.semibold))
            Text(subtitle).font(.subheadline).foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

private struct SoftCard<Content: View>: View {
    @ViewBuilder let content: Content
    var body: some View {
        VStack(alignment: .leading, spacing: 16) { content }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(20)
            .background(Color(uiColor: .secondarySystemGroupedBackground),
                        in: RoundedRectangle(cornerRadius: 24, style: .continuous))
    }
}

private struct SubjectPicker: View {
    @Binding var selection: Subject
    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(Subject.allCases) { subject in
                    Button(subject.label) { selection = subject }
                        .font(.subheadline.weight(.medium))
                        .padding(.horizontal, 16).padding(.vertical, 10)
                        .foregroundStyle(selection == subject ? accent : .primary)
                        .background(selection == subject ? accent.opacity(0.16) : Color(uiColor: .tertiarySystemFill),
                                    in: Capsule())
                }
            }
        }
    }
}

struct AskView: View {
    @EnvironmentObject private var store: StudyStore
    @State private var subject: Subject = .physics
    @State private var mode: SolveMode = .guided
    @State private var question = ""
    @State private var photo: PhotosPickerItem?
    @State private var imageData: Data?
    @State private var imageError: String?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                PageHeading(kicker: "Your study space", title: "What are you stuck on?",
                            subtitle: "Ask anything. Choose how you want to learn.")
                if !store.hasKey {
                    SoftCard {
                        Label("Preview mode", systemImage: "sparkles").font(.headline)
                        Text("Add a Gemini API key in Settings for real AI answers.")
                            .font(.subheadline)
                    }
                    .background(accent.opacity(0.08), in: RoundedRectangle(cornerRadius: 24))
                }
                SoftCard {
                    Text("01  Subject").font(.headline)
                    SubjectPicker(selection: $subject)
                    Text("02  Your question").font(.headline)
                    ZStack(alignment: .topLeading) {
                        if question.isEmpty {
                            Text("Type your JEE question here...")
                                .foregroundStyle(.secondary)
                                .padding(.leading, 12).padding(.top, 14)
                                .allowsHitTesting(false)
                        }
                        TextEditor(text: $question)
                            .frame(minHeight: 96)
                            .scrollContentBackground(.hidden)
                            .padding(6)
                            .onChange(of: question) { _, _ in store.clearAnswer() }
                    }
                    .background(Color(uiColor: .tertiarySystemFill),
                                in: RoundedRectangle(cornerRadius: 14))
                    HStack {
                        PhotosPicker(selection: $photo, matching: .images) {
                            Label(imageData == nil ? "Attach image" : "Image attached", systemImage: "photo")
                        }
                        .buttonStyle(.bordered)
                        if imageData != nil {
                            Button("Remove") { imageData = nil; photo = nil }
                                .buttonStyle(.borderless)
                        }
                    }
                    .onChange(of: photo) { _, selected in
                        Task {
                            guard let data = try? await selected?.loadTransferable(type: Data.self),
                                  let jpeg = UIImage(data: data)?.jpegData(compressionQuality: 0.8),
                                  jpeg.count <= 6_000_000 else {
                                imageError = "Choose an image smaller than 6 MB."
                                return
                            }
                            imageData = jpeg
                            imageError = nil
                        }
                    }
                    if let imageError { Text(imageError).font(.caption).foregroundStyle(.red) }
                    Text("03  Answer style").font(.headline)
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack {
                            ForEach(SolveMode.allCases) { option in
                                Button(option.label) { mode = option }
                                    .font(.subheadline)
                                    .padding(10)
                                    .foregroundStyle(mode == option ? accent : .primary)
                                    .background(mode == option ? accent.opacity(0.16) : Color(uiColor: .tertiarySystemFill),
                                                in: Capsule())
                            }
                        }
                    }
                }
                switch store.solveStatus {
                case let .answer(text, sample):
                    SoftCard {
                        HStack {
                            Text("Your answer").font(.title2.weight(.semibold))
                            Spacer()
                            if sample { Text("SAMPLE").font(.caption).foregroundStyle(accent) }
                        }
                        Text(text).textSelection(.enabled)
                        Text("Saved to your history").font(.caption).foregroundStyle(accent)
                    }
                case let .failure(message):
                    SoftCard {
                        Label("Could not solve", systemImage: "exclamationmark.circle")
                            .foregroundStyle(.red)
                        Text(message)
                    }
                default: EmptyView()
                }
            }
            .padding(20)
        }
        .background(Color(uiColor: .systemGroupedBackground))
        .navigationTitle("DoubtBuddy")
        .navigationBarTitleDisplayMode(.inline)
        .safeAreaInset(edge: .bottom, spacing: 0) {
            Button {
                store.solve(subject: subject, mode: mode, question: question, image: imageData)
            } label: {
                HStack(spacing: 9) {
                    if store.solveStatus == .loading { SwiftUI.ProgressView().tint(.white) }
                    else { Image(systemName: "paperplane.fill") }
                    Text(store.solveStatus == .loading ? "Thinking..." : "Solve question")
                }
                .font(.headline)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 8)
            }
            .buttonStyle(.borderedProminent).tint(accent)
            .disabled((question.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && imageData == nil)
                      || store.solveStatus == .loading)
            .padding(.horizontal, 20)
            .padding(.vertical, 8)
            .background(.regularMaterial)
        }
    }
}

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
    @State private var revealed = false

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
                        if revealed {
                            Text("Answer: " + question.choices[question.correct]).font(.headline)
                            Text(question.explanation)
                            HStack {
                                Button("Review again") {
                                    store.record(question, selected: (question.correct + 1) % 4, review: true)
                                    revealed = false
                                }.buttonStyle(.bordered)
                                Spacer()
                                Button("Got it") {
                                    store.record(question, selected: question.correct, review: true)
                                    revealed = false
                                }.buttonStyle(.borderedProminent).tint(accent)
                            }
                        } else {
                            Button("Reveal answer") { revealed = true }
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
    }
}

struct ProgressViewPage: View {
    @EnvironmentObject private var store: StudyStore

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                PageHeading(kicker: "Your journey", title: "Progress at a glance",
                            subtitle: "Small steps add up.")
                SoftCard {
                    HStack {
                        metric(String(store.attempts.count), "Practiced")
                        Spacer()
                        metric(String(StudyStats.accuracy(store.attempts)) + "%", "Accuracy")
                        Spacer()
                        metric(String(store.doubts.count), "Doubts")
                    }
                }
                SoftCard {
                    Text("Accuracy by subject").font(.title3.weight(.semibold))
                    ForEach(Subject.allCases) { subject in
                        let entries = store.attempts.filter { $0.subject == subject }
                        let score = StudyStats.accuracy(entries)
                        HStack {
                            Text(subject.label)
                            Spacer()
                            Text(entries.isEmpty ? "Not started" : String(score) + "% · " +
                                 String(entries.count) + " attempts").font(.caption).foregroundStyle(.secondary)
                        }
                        SwiftUI.ProgressView(value: Double(score), total: 100)
                            .tint(accent)
                    }
                }
                SoftCard {
                    Text("Review queue").font(.headline)
                    Text(String(StudyStats.due(store.attempts).count) + " questions ready for review")
                }
            }.padding(20)
        }
        .background(Color(uiColor: .systemGroupedBackground))
        .navigationTitle("DoubtBuddy")
        .navigationBarTitleDisplayMode(.inline)
    }

    private func metric(_ value: String, _ label: String) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(value).font(.title.weight(.semibold)).foregroundStyle(accent)
            Text(label).font(.caption)
        }
    }
}

struct SavedView: View {
    @EnvironmentObject private var store: StudyStore
    @State private var opened: Doubt?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                PageHeading(kicker: "Your library", title: "Saved answers",
                            subtitle: "Everything you've worked through.")
                if store.doubts.isEmpty {
                    SoftCard {
                        Text("Nothing saved yet").font(.title2.weight(.semibold))
                        Text("Your answers appear here after your first question.")
                    }
                } else {
                    ForEach(store.doubts) { doubt in
                        SoftCard {
                            HStack {
                                Text(doubt.subject.label).foregroundStyle(accent)
                                Spacer()
                                if doubt.isSample { Text("SAMPLE").font(.caption) }
                                if doubt.bookmarked { Image(systemName: "bookmark.fill").foregroundStyle(accent) }
                            }
                            Button { opened = doubt } label: {
                                Text(doubt.question).font(.headline)
                                    .lineLimit(2).frame(maxWidth: .infinity, alignment: .leading)
                            }.buttonStyle(.plain)
                            Text(doubt.createdAt.formatted(date: .abbreviated, time: .omitted))
                                .font(.caption).foregroundStyle(.secondary)
                            HStack {
                                Button(doubt.bookmarked ? "Unsave" : "Bookmark") { store.toggleBookmark(doubt.id) }
                                Spacer()
                                Button("Delete", role: .destructive) { store.deleteDoubt(doubt.id) }
                            }.buttonStyle(.borderless)
                        }
                    }
                }
            }.padding(20)
        }
        .background(Color(uiColor: .systemGroupedBackground))
        .navigationTitle("DoubtBuddy")
        .navigationBarTitleDisplayMode(.inline)
        .sheet(item: $opened) { doubt in
            NavigationStack {
                ScrollView {
                    VStack(alignment: .leading, spacing: 20) {
                        if doubt.isSample { Text("SAMPLE").foregroundStyle(accent) }
                        Text(doubt.question).font(.title3.weight(.semibold))
                        Text(doubt.answer).textSelection(.enabled)
                    }.padding(20)
                }
                .navigationTitle("Saved answer")
                .toolbar { ToolbarItem(placement: .topBarTrailing) { Button("Done") { opened = nil } } }
            }
        }
    }
}

struct SettingsView: View {
    @EnvironmentObject private var store: StudyStore
    @State private var key = ""
    @State private var saved = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                PageHeading(kicker: "Preferences", title: "Make it yours",
                            subtitle: "Configure your personal AI connection.")
                SoftCard {
                    Text("Gemini API key").font(.title3.weight(.semibold))
                    Text(store.hasKey ? "A key is stored in iOS Keychain. Enter a new one to replace it." :
                         "No key configured. Answers use a clearly labeled sample.")
                    SecureField("New API key", text: $key)
                        .textFieldStyle(.roundedBorder)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                    Button("Save key securely") {
                        store.saveKey(key); key = ""; saved = true
                    }.buttonStyle(.borderedProminent).tint(accent).disabled(key.isEmpty)
                    if store.hasKey {
                        Button("Remove stored key", role: .destructive) {
                            store.saveKey(""); saved = true
                        }.buttonStyle(.bordered)
                    }
                    if saved { Text("Your AI settings were updated.").foregroundStyle(accent) }
                    Text("Your key stays in iOS Keychain and is sent to Google's Gemini API over HTTPS. " +
                         "Google may process submitted questions. API usage may incur charges.")
                        .font(.caption).foregroundStyle(.secondary)
                }
                SoftCard {
                    Text("About DoubtBuddy").font(.headline)
                    Text("Native JEE study companion. Practice and review work offline.")
                    Text("Version 0.1.0").font(.caption).foregroundStyle(.secondary)
                }
            }.padding(20)
        }
        .background(Color(uiColor: .systemGroupedBackground))
        .navigationTitle("Settings")
    }
}
