package dev.doubtbuddy

import android.app.Activity
import android.app.Instrumentation
import android.content.Intent
import android.provider.MediaStore
import android.net.Uri
import androidx.test.espresso.intent.Intents
import androidx.test.espresso.intent.Intents.intending
import androidx.test.espresso.intent.matcher.IntentMatchers.hasAction
import androidx.compose.ui.test.hasSetTextAction
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.assertIsEnabled
import androidx.compose.ui.test.assertDoesNotExist
import androidx.compose.ui.test.assertIsSelected
import androidx.compose.ui.test.assertIsNotSelected
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.test.printToLog
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performTextInput
import dev.doubtbuddy.data.CameraCapture
import org.junit.Rule
import org.junit.Assert.assertEquals
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

    @Test fun takePhotoLaunchesSystemCameraWithOutputUri() {
        Intents.init()
        try {
            intending(hasAction(MediaStore.ACTION_IMAGE_CAPTURE))
                .respondWith(Instrumentation.ActivityResult(Activity.RESULT_CANCELED, null))
            compose.onNodeWithText("Take photo").performClick()
            val captured = Intents.getIntents()
                .firstOrNull { it.action == MediaStore.ACTION_IMAGE_CAPTURE }
                ?: error("No camera capture intent was sent.")
            assertEquals("content", captured.getParcelableExtra<Uri>(MediaStore.EXTRA_OUTPUT)?.scheme)
        } finally {
            Intents.release()
        }
    }

    @Test fun galleryPhotoCanBeSelectedAndSolvedWithoutQuestionText() {
        val context = compose.activity
        val target = CameraCapture.createTarget(context)
        val bitmap = android.graphics.Bitmap.createBitmap(200, 160, android.graphics.Bitmap.Config.ARGB_8888)
        bitmap.eraseColor(android.graphics.Color.WHITE)
        target.file.outputStream().use { bitmap.compress(android.graphics.Bitmap.CompressFormat.JPEG, 85, it) }
        bitmap.recycle()
        Intents.init()
        try {
            intending(hasAction(MediaStore.ACTION_PICK_IMAGES))
                .respondWith(Instrumentation.ActivityResult(Activity.RESULT_OK,
                    Intent().setData(target.uri).addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)))
            compose.onNodeWithText("Gallery").performClick()
            val picked = Intents.getIntents().firstOrNull { it.action == MediaStore.ACTION_PICK_IMAGES }
                ?: error("System photo picker was not launched.")
            assertEquals("image/*", picked.type)
            compose.waitUntil(30_000) {
                compose.onAllNodesWithText("Photo attached").fetchSemanticsNodes().isNotEmpty()
            }
            compose.onNodeWithText("Solve question").assertIsEnabled().performClick()
            compose.waitUntil(30_000) {
                compose.onAllNodesWithText("Your answer").fetchSemanticsNodes().isNotEmpty() ||
                    compose.onAllNodesWithText("Could not solve").fetchSemanticsNodes().isNotEmpty()
            }
            compose.onNodeWithText("Your answer").assertExists()
            compose.onNodeWithText("Saved").performClick()
            compose.onNodeWithText("Image question").assertExists()
        } finally {
            Intents.release()
            target.file.delete()
        }
    }

    @Test fun editingAnAnsweredQuestionClearsTheOldAnswer() {
        compose.onNode(hasSetTextAction()).performTextInput("Initial question")
        compose.onNodeWithText("Solve question").performClick()
        compose.waitUntil(30_000) {
            compose.onAllNodesWithText("Your answer").fetchSemanticsNodes().isNotEmpty()
        }
        compose.onNodeWithText("Your answer").assertExists()
        compose.onNode(hasSetTextAction()).performTextInput(" changed")
        compose.waitForIdle()
        compose.onNodeWithText("Your answer").assertDoesNotExist()
    }

    @Test fun practiceAnswerExposesSelectionToAccessibility() {
        compose.onNodeWithText("Practice").performClick()
        compose.onNodeWithText("25 m", substring = true).assertIsNotSelected().performClick()
        compose.onNodeWithText("25 m", substring = true).assertIsSelected()
        compose.onNodeWithText("10 m", substring = true).performClick()
        compose.onNodeWithText("25 m", substring = true).assertIsNotSelected()
        compose.onNodeWithText("10 m", substring = true).assertIsSelected()
        compose.onNodeWithText("Check answer").performClick()
        compose.onNodeWithText("10 m", substring = true).assertIsSelected()
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
