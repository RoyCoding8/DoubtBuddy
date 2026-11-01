package dev.doubtbuddy.data

import dev.doubtbuddy.domain.SolveMode
import dev.doubtbuddy.domain.Subject
import java.net.HttpURLConnection
import java.net.URL
import org.json.JSONArray
import org.json.JSONObject

data class ImageAttachment(val mimeType: String, val base64: String)

class GeminiClient(private val endpoint: URL = URL("https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent")) {
    fun solve(
        apiKey: String,
        subject: Subject,
        mode: SolveMode,
        question: String,
        image: ImageAttachment? = null
    ): String {
        val parts = JSONArray().put(JSONObject().put("text", question))
        if (image != null) {
            parts.put(JSONObject().put("inline_data", JSONObject()
                .put("mime_type", image.mimeType)
                .put("data", image.base64)))
        }
        val instruction = "You are DoubtBuddy, a careful JEE tutor for " + subject.label + ". " +
            mode.instruction + " Check calculations, do not invent facts, say when uncertain, and format equations in plain text."
        val payload = JSONObject()
            .put("systemInstruction", JSONObject().put("parts", JSONArray().put(JSONObject().put("text", instruction))))
            .put("contents", JSONArray().put(JSONObject().put("role", "user").put("parts", parts)))
            .put("generationConfig", JSONObject().put("maxOutputTokens", 2048))

        val connection = endpoint.openConnection() as HttpURLConnection
        return try {
            connection.requestMethod = "POST"
            connection.connectTimeout = 15_000
            connection.readTimeout = 45_000
            connection.setRequestProperty("Content-Type", "application/json")
            connection.setRequestProperty("x-goog-api-key", apiKey)
            connection.doOutput = true
            connection.outputStream.use { it.write(payload.toString().toByteArray(Charsets.UTF_8)) }
            if (connection.responseCode !in 200..299) {
                val message = when (connection.responseCode) {
                    400 -> "The request could not be processed. Try a shorter question or smaller image."
                    401, 403 -> "API key rejected. Check your Gemini key in Settings."
                    429 -> "Gemini is rate limited. Try again shortly."
                    in 500..599 -> "Gemini is temporarily unavailable. Please retry."
                    else -> "Couldn't solve this question (HTTP " + connection.responseCode + ")."
                }
                throw IllegalStateException(message)
            }
            val response = JSONObject(connection.inputStream.bufferedReader().use { it.readText() })
            val partsResponse = response.optJSONArray("candidates")?.optJSONObject(0)
                ?.optJSONObject("content")?.optJSONArray("parts")
            val answer = buildString {
                for (i in 0 until (partsResponse?.length() ?: 0)) {
                    val text = partsResponse?.optJSONObject(i)?.optString("text", "").orEmpty()
                    if (text.isNotBlank()) append(text)
                }
            }.trim()
            if (answer.isBlank()) throw IllegalStateException("No answer was returned. Please try rephrasing.")
            answer
        } finally {
            connection.disconnect()
        }
    }
}
