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

    func testReviewHidesPreviousRevealWhenDueQuestionChanges() {
        let app = XCUIApplication()
        app.launch()
        app.tabBars.buttons["Practice"].tap()

        let wrongFirst = app.buttons.matching(NSPredicate(format: "label CONTAINS %@", "10 m")).firstMatch
        XCTAssertTrue(wrongFirst.waitForExistence(timeout: 10))
        wrongFirst.tap()
        app.buttons["Check answer"].tap()
        app.buttons["Next question"].tap()

        let wrongSecond = app.buttons.matching(NSPredicate(format: "label CONTAINS %@", "3 m/s²")).firstMatch
        XCTAssertTrue(wrongSecond.waitForExistence(timeout: 10))
        wrongSecond.tap()
        app.buttons["Check answer"].tap()

        app.tabBars.buttons["Review"].tap()
        let reveal = app.buttons["Reveal answer"]
        XCTAssertTrue(reveal.waitForExistence(timeout: 10))
        reveal.tap()
        XCTAssertTrue(app.staticTexts["Answer: 25 m"].waitForExistence(timeout: 10))

        app.tabBars.buttons["Practice"].tap()
        app.buttons["Chemistry"].tap()
        app.buttons["Physics"].tap()
        let rightFirst = app.buttons.matching(NSPredicate(format: "label CONTAINS %@", "25 m")).firstMatch
        XCTAssertTrue(rightFirst.waitForExistence(timeout: 10))
        rightFirst.tap()
        app.buttons["Check answer"].tap()

        app.tabBars.buttons["Review"].tap()
        XCTAssertTrue(app.staticTexts["A net force of 12 N acts on a 3 kg body. Its acceleration is"].waitForExistence(timeout: 10))
        XCTAssertTrue(app.buttons["Reveal answer"].waitForExistence(timeout: 10))
    }

    func testSettingsCanReplaceAndRemoveStoredKey() {
        let app = XCUIApplication()
        app.launch()
        app.buttons["Settings"].tap()

        let editor = app.secureTextFields["New API key"]
        XCTAssertTrue(editor.waitForExistence(timeout: 10))
        editor.tap()
        editor.typeText("local-test-key-never-sent")
        app.buttons["Save key securely"].tap()
        XCTAssertTrue(app.staticTexts["Your AI settings were updated."].waitForExistence(timeout: 10))
        XCTAssertTrue(app.buttons["Remove stored key"].exists)

        app.buttons["Remove stored key"].tap()
        XCTAssertTrue(app.staticTexts["No key configured. Answers use a clearly labeled sample."].waitForExistence(timeout: 10))
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
