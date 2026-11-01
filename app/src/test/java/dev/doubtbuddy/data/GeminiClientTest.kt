package dev.doubtbuddy.data

import dev.doubtbuddy.domain.SolveMode
import dev.doubtbuddy.domain.Subject
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Test

class GeminiClientTest {
    @Test fun sendsSubjectModeAndImageThroughRequestPayload() {
        val server = MockWebServer()
        server.enqueue(MockResponse().setResponseCode(200)
            .setBody("""{"candidates":[{"content":{"parts":[{"text":"Step 1. "},{"text":"Answer is 42."}]}}]}"""))
        server.start()
        try {
            val answer = GeminiClient(server.url("/solve").toUrl()).solve(
                "sample-key", Subject.PHYSICS, SolveMode.GUIDED, "Question here",
                ImageAttachment("image/png", "AQID")
            )
            val request = server.takeRequest()
            assertEquals("Step 1. Answer is 42.", answer)
            assertEquals("sample-key", request.getHeader("x-goog-api-key"))
            assertEquals("POST", request.method)
            val body = request.body.readUtf8()
            assertTrue(body.contains("Question here"))
            assertTrue(body.contains("Physics"))
            assertTrue(body.contains("image/png"))
            assertTrue(body.contains("AQID"))
        } finally {
            server.shutdown()
        }
    }

    @Test fun rateLimitShowsRecoverableMessageWithoutLeakingKey() {
        val server = MockWebServer()
        server.enqueue(MockResponse().setResponseCode(429))
        server.start()
        try {
            val client = GeminiClient(server.url("/solve").toUrl())
            val error = assertThrows(IllegalStateException::class.java) {
                client.solve("super-secret", Subject.CHEMISTRY, SolveMode.HINT, "Why?")
            }
            assertTrue(error.message.orEmpty().contains("rate limited"))
            assertTrue(!error.message.orEmpty().contains("super-secret"))
        } finally {
            server.shutdown()
        }
    }
}
