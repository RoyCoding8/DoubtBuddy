package dev.doubtbuddy.data

import com.sun.net.httpserver.HttpServer
import dev.doubtbuddy.domain.SolveMode
import dev.doubtbuddy.domain.Subject
import java.net.InetSocketAddress
import java.net.URL
import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Test

class GeminiClientTest {
    @Test fun sendsSubjectModeAndImageThroughHttpsCompatiblePayload() {
        val server = HttpServer.create(InetSocketAddress("127.0.0.1", 0), 0)
        var key: String? = null
        var body = ""
        server.createContext("/solve") { request ->
            key = request.requestHeaders.getFirst("x-goog-api-key")
            body = request.requestBody.bufferedReader().readText()
            val response = """{"candidates":[{"content":{"parts":[{"text":"Step 1. "},{"text":"Answer is 42."}]}}]}"""
            request.responseHeaders.set("Content-Type", "application/json")
            request.sendResponseHeaders(200, response.toByteArray().size.toLong())
            request.responseBody.use { it.write(response.toByteArray()) }
        }
        server.start()
        try {
            val endpoint = URL("http://127.0.0.1:" + server.address.port + "/solve")
            val answer = GeminiClient(endpoint).solve("sample-key", Subject.PHYSICS, SolveMode.GUIDED,
                "Question here", ImageAttachment("image/png", "AQID"))
            assertEquals("Step 1. Answer is 42.", answer)
            assertEquals("sample-key", key)
            assertTrue(body.contains("Question here"))
            assertTrue(body.contains("Physics"))
            assertTrue(body.contains("image/png"))
            assertTrue(body.contains("AQID"))
        } finally {
            server.stop(0)
        }
    }

    @Test fun rateLimitShowsRecoverableMessageWithoutLeakingKey() {
        val server = HttpServer.create(InetSocketAddress("127.0.0.1", 0), 0)
        server.createContext("/") { request ->
            request.requestBody.close()
            request.sendResponseHeaders(429, -1)
            request.close()
        }
        server.start()
        try {
            val client = GeminiClient(URL("http://127.0.0.1:" + server.address.port))
            val error = assertThrows(IllegalStateException::class.java) {
                client.solve("super-secret", Subject.CHEMISTRY, SolveMode.HINT, "Why?")
            }
            assertTrue(error.message.orEmpty().contains("rate limited"))
            assertTrue(!error.message.orEmpty().contains("super-secret"))
        } finally {
            server.stop(0)
        }
    }
}
