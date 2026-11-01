import XCTest

@MainActor
final class DoubtBuddyUITests: XCTestCase {
    func testNavigateFromAskToPracticeAndProgress() {
        let app = XCUIApplication()
        app.launch()

        XCTAssertTrue(app.staticTexts["What are you stuck on?"].waitForExistence(timeout: 15))
        let practice = app.tabBars.buttons["Practice"]
        XCTAssertTrue(practice.exists)
        practice.tap()
        XCTAssertTrue(app.staticTexts["Build your confidence"].waitForExistence(timeout: 10))

        app.tabBars.buttons["Progress"].tap()
        XCTAssertTrue(app.staticTexts["Progress at a glance"].waitForExistence(timeout: 10))
        app.tabBars.buttons["Saved"].tap()
        XCTAssertTrue(app.staticTexts["Saved answers"].waitForExistence(timeout: 10))
    }
}
