import SwiftUI
import UIKit

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
    @State private var keyFailure = false

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
                        .onChange(of: key) { _, newValue in
                            if !newValue.isEmpty {
                                saved = false
                                keyFailure = false
                            }
                        }
                    Button("Save key securely") {
                        saved = store.saveKey(key)
                        keyFailure = !saved
                        if saved { key = "" }
                    }.buttonStyle(.borderedProminent).tint(accent).disabled(key.isEmpty)
                    if store.hasKey {
                        Button("Remove stored key", role: .destructive) {
                            saved = store.saveKey("")
                            keyFailure = !saved
                        }.buttonStyle(.bordered)
                    }
                    if saved { Text("Your AI settings were updated.").foregroundStyle(accent) }
                    if keyFailure {
                        Text("Could not update the key. Check your device and try again.")
                            .foregroundStyle(.red)
                    }
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
