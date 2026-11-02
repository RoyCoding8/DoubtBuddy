import SwiftUI
import PhotosUI
import UIKit

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
                        .onChange(of: subject) { _, _ in store.clearAnswer() }
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
                            Button("Remove") {
                                imageData = nil
                                photo = nil
                                imageError = nil
                                store.clearAnswer()
                            }
                                .buttonStyle(.borderless)
                        }
                    }
                    .onChange(of: photo) { _, selected in
                        guard let selected else { return }
                        Task {
                            guard let data = try? await selected.loadTransferable(type: Data.self),
                                  let jpeg = UIImage(data: data)?.jpegData(compressionQuality: 0.8),
                                  jpeg.count <= 6_000_000 else {
                                imageError = "Choose an image smaller than 6 MB."
                                return
                            }
                            imageData = jpeg
                            imageError = nil
                            store.clearAnswer()
                        }
                    }
                    if let imageError { Text(imageError).font(.caption).foregroundStyle(.red) }
                    Text("03  Answer style").font(.headline)
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack {
                            ForEach(SolveMode.allCases) { option in
                                Button(option.label) {
                                    if mode != option {
                                        mode = option
                                        store.clearAnswer()
                                    }
                                }
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
