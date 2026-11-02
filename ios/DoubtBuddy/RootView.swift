import SwiftUI

private enum Tab: Hashable {
    case ask, practice, review, progress, saved
}


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
