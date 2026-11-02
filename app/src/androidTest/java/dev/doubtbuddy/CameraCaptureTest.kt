package dev.doubtbuddy

import android.graphics.Bitmap
import android.graphics.Color
import android.util.Base64
import androidx.test.platform.app.InstrumentationRegistry
import dev.doubtbuddy.data.CameraCapture
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class CameraCaptureTest {
    @Test fun importsPickedGalleryUriAsJpegWithoutStoragePermission() {
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        val target = CameraCapture.createTarget(context)
        try {
            val bitmap = Bitmap.createBitmap(160, 120, Bitmap.Config.ARGB_8888)
            bitmap.eraseColor(Color.WHITE)
            target.file.outputStream().use { bitmap.compress(Bitmap.CompressFormat.JPEG, 90, it) }
            bitmap.recycle()
            val result = CameraCapture.encode(context, target.uri)
            assertEquals("image/jpeg", result.mimeType)
            val decoded = Base64.decode(result.base64, Base64.NO_WRAP)
            assertTrue(decoded.size > 0)
            assertTrue(decoded.size <= 6_000_000)
        } finally {
            target.file.delete()
        }
    }

    @Test fun preparesFullSizeCameraImageForGemini() {
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        val target = CameraCapture.createTarget(context)
        try {
            assertEquals("content", target.uri.scheme)
            assertEquals(context.packageName + ".capture", target.uri.authority)

            val bitmap = Bitmap.createBitmap(2600, 1600, Bitmap.Config.ARGB_8888)
            bitmap.eraseColor(Color.WHITE)
            target.file.outputStream().use { bitmap.compress(Bitmap.CompressFormat.JPEG, 92, it) }
            bitmap.recycle()

            val attachment = CameraCapture.encode(target.file)
            assertEquals("image/jpeg", attachment.mimeType)
            val bytes = Base64.decode(attachment.base64, Base64.NO_WRAP)
            assertTrue(bytes.isNotEmpty())
            assertTrue(bytes.size <= 6_000_000)
        } finally {
            target.file.delete()
        }
    }
}
