import SwiftUI

@main
struct DoubtBuddyApp: App {
    @StateObject private var store = StudyStore()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(store)
        }
    }
}
