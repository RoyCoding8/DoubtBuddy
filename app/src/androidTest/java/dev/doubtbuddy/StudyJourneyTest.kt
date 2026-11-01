package dev.doubtbuddy

import androidx.compose.ui.test.hasSetTextAction
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.assertIsEnabled
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.test.printToLog
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performTextInput
import org.junit.Rule
import org.junit.Test

class StudyJourneyTest {
    @get:Rule val compose = createAndroidComposeRule<MainActivity>()

    @Test fun solveOfflineAndFindSavedAnswer() {
        compose.onNode(hasSetTextAction()).performTextInput("What is Newton's second law?")
        compose.waitForIdle()
        compose.onNodeWithText("Solve question").assertIsEnabled().performClick()
        compose.onRoot().printToLog("DOUBTBUDDY_AFTER_SUBMIT")
        compose.waitUntil(30_000) {
            compose.onAllNodesWithText("Your answer").fetchSemanticsNodes().isNotEmpty() ||
                compose.onAllNodesWithText("Could not solve").fetchSemanticsNodes().isNotEmpty()
        }
        compose.onRoot().printToLog("DOUBTBUDDY_AFTER_RESULT")
        compose.onNodeWithText("Your answer").assertExists()
        compose.onNodeWithText("Sample").assertExists()
        compose.onNodeWithText("Saved").performClick()
        compose.onNodeWithText("Saved answers").assertExists()
        compose.onNodeWithText("What is Newton's second law?").assertExists()
    }

    @Test fun practiceShowsExplanationAndProgress() {
        compose.onNodeWithText("Practice").performClick()
        compose.onNodeWithText("25 m", substring = true).performClick()
        compose.onNodeWithText("Check answer").performClick()
        compose.onNodeWithText("Correct").assertExists()
        compose.onNodeWithText("Next question").performClick()
        compose.onNodeWithText("Progress").performClick()
        compose.onNodeWithText("Progress at a glance").assertExists()
    }
}
