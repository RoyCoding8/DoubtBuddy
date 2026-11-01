package dev.doubtbuddy

import androidx.compose.ui.test.hasSetTextAction
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performTextInput
import org.junit.Rule
import org.junit.Test

class StudyJourneyTest {
    @get:Rule val compose = createAndroidComposeRule<MainActivity>()

    @Test fun solveOfflineAndFindSavedAnswer() {
        compose.onNode(hasSetTextAction()).performTextInput("What is Newton's second law?")
        compose.onNodeWithText("Solve question").performClick()
        compose.waitUntil(15_000) {
            compose.onAllNodesWithText("Your answer").fetchSemanticsNodes().isNotEmpty()
        }
        compose.onNodeWithText("Sample").assertExists()
        compose.onNodeWithText("Saved").performClick()
        compose.onNodeWithText("Saved answers").assertExists()
        compose.onNodeWithText("What is Newton's second law?").assertExists()
    }

    @Test fun practiceShowsExplanationAndProgress() {
        compose.onNodeWithText("Practice").performClick()
        compose.onNodeWithText("25 m").performClick()
        compose.onNodeWithText("Check answer").performClick()
        compose.onNodeWithText("Correct").assertExists()
        compose.onNodeWithText("Next question").performClick()
        compose.onNodeWithText("Progress").performClick()
        compose.onNodeWithText("Progress at a glance").assertExists()
    }
}
