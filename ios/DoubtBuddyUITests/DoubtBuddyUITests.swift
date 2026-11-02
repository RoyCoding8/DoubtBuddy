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


    func testEditingQuestionClearsAnOldAnswer() {
        let app = XCUIApplication()
        app.launch()

        let editor = app.textViews.firstMatch
        XCTAssertTrue(editor.waitForExistence(timeout: 15))
        editor.tap()
        editor.typeText("Original physics question")
        app.buttons.matching(NSPredicate(format: "label CONTAINS %@", "Solve question")).firstMatch.tap()
        XCTAssertTrue(app.staticTexts["Your answer"].waitForExistence(timeout: 20))

        editor.tap()
        editor.typeText(" updated")
        XCTAssertFalse(app.staticTexts["Your answer"].exists)
    }

    func testOfflineAnswerPersistsAfterRelaunch() {
        let app = XCUIApplication()
        app.launch()

        let editor = app.textViews.firstMatch
        XCTAssertTrue(editor.waitForExistence(timeout: 15))
        editor.tap()
        editor.typeText("What does Newton's second law say?")

        let solve = app.buttons.matching(NSPredicate(format: "label CONTAINS %@", "Solve question")).firstMatch
        XCTAssertTrue(solve.waitForExistence(timeout: 10))
        XCTAssertTrue(solve.isEnabled)
        solve.tap()
        XCTAssertTrue(app.staticTexts["Your answer"].waitForExistence(timeout: 20))

        app.terminate()
        app.launch()
        app.tabBars.buttons["Saved"].tap()
        XCTAssertTrue(app.staticTexts["Saved answers"].waitForExistence(timeout: 10))
        let saved = app.buttons.matching(NSPredicate(format: "label CONTAINS %@", "What does Newton's second law say?")).firstMatch
        XCTAssertTrue(saved.waitForExistence(timeout: 10))
    }
}
