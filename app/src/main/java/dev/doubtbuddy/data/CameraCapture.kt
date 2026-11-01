package dev.doubtbuddy.data

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Matrix
import android.media.ExifInterface
import android.net.Uri
import android.util.Base64
import androidx.core.content.FileProvider
import java.io.ByteArrayOutputStream
import java.io.File
import java.io.IOException

data class CameraTarget(val uri: Uri, val file: File)

object CameraCapture {
    fun createTarget(context: Context): CameraTarget {
        val directory = File(context.cacheDir, "questions").apply { mkdirs() }
        val file = File.createTempFile("question-", ".jpg", directory)
        val uri = FileProvider.getUriForFile(context, context.packageName + ".capture", file)
        return CameraTarget(uri, file)
    }

    fun encode(file: File): ImageAttachment {
        val options = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        BitmapFactory.decodeFile(file.absolutePath, options)
        if (options.outWidth <= 0 || options.outHeight <= 0) throw IOException("Camera returned no usable photo.")

        var sample = 1
        while (maxOf(options.outWidth, options.outHeight) / sample > 2200) sample *= 2
        options.inJustDecodeBounds = false
        options.inSampleSize = sample
        val bitmap = BitmapFactory.decodeFile(file.absolutePath, options)
            ?: throw IOException("Could not decode the camera photo.")
        val orientation = ExifInterface(file.absolutePath).getAttributeInt(
            ExifInterface.TAG_ORIENTATION, ExifInterface.ORIENTATION_NORMAL
        )
        val degrees = when (orientation) {
            ExifInterface.ORIENTATION_ROTATE_90 -> 90f
            ExifInterface.ORIENTATION_ROTATE_180 -> 180f
            ExifInterface.ORIENTATION_ROTATE_270 -> 270f
            else -> 0f
        }
        val rotated = if (degrees == 0f) bitmap else Bitmap.createBitmap(
            bitmap, 0, 0, bitmap.width, bitmap.height, Matrix().apply { postRotate(degrees) }, true
        )
        val output = ByteArrayOutputStream()
        if (!rotated.compress(Bitmap.CompressFormat.JPEG, 82, output)) {
            throw IOException("Could not prepare the captured photo.")
        }
        if (output.size() > 6_000_000) {
            output.reset()
            if (!rotated.compress(Bitmap.CompressFormat.JPEG, 65, output)) {
                throw IOException("Could not prepare the captured photo.")
            }
        }
        if (output.size() > 6_000_000) throw IOException("Photo is too large. Move closer and retake it.")
        return ImageAttachment("image/jpeg", Base64.encodeToString(output.toByteArray(), Base64.NO_WRAP))
    }
}
