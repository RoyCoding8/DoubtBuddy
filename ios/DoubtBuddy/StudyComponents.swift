import SwiftUI
import UIKit

let accent = Color(red: 0.27, green: 0.36, blue: 0.63)

struct PageHeading: View {
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

struct SoftCard<Content: View>: View {
    @ViewBuilder let content: Content
    var body: some View {
        VStack(alignment: .leading, spacing: 16) { content }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(20)
            .background(Color(uiColor: .secondarySystemGroupedBackground),
                        in: RoundedRectangle(cornerRadius: 24, style: .continuous))
    }
}

struct SubjectPicker: View {
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
