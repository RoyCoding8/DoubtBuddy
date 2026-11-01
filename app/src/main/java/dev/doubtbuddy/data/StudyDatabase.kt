package dev.doubtbuddy.data

import android.content.ContentValues
import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper
import dev.doubtbuddy.domain.Doubt
import dev.doubtbuddy.domain.PracticeAttempt
import dev.doubtbuddy.domain.SolveMode
import dev.doubtbuddy.domain.Subject

class StudyDatabase(context: Context) : SQLiteOpenHelper(context, "doubtbuddy.db", null, 1) {
    override fun onCreate(db: SQLiteDatabase) {
        db.execSQL("CREATE TABLE doubts (id TEXT PRIMARY KEY, subject TEXT NOT NULL, question TEXT NOT NULL, answer TEXT NOT NULL, mode TEXT NOT NULL, created_at INTEGER NOT NULL, is_sample INTEGER NOT NULL, bookmarked INTEGER NOT NULL DEFAULT 0)")
        db.execSQL("CREATE TABLE attempts (id TEXT PRIMARY KEY, question_id TEXT NOT NULL, subject TEXT NOT NULL, chapter TEXT NOT NULL, selected INTEGER NOT NULL, correct INTEGER NOT NULL, completed_at INTEGER NOT NULL, next_review_at INTEGER NOT NULL)")
        db.execSQL("CREATE INDEX attempts_question_time ON attempts(question_id, completed_at)")
    }

    override fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) {
        error("No schema migration exists from $oldVersion to $newVersion")
    }

    fun doubts(): List<Doubt> = readableDatabase.rawQuery(
        "SELECT id,subject,question,answer,mode,created_at,is_sample,bookmarked FROM doubts ORDER BY created_at DESC", null
    ).use { cursor ->
        buildList {
            while (cursor.moveToNext()) add(Doubt(
                id = cursor.getString(0),
                subject = Subject.valueOf(cursor.getString(1)),
                question = cursor.getString(2),
                answer = cursor.getString(3),
                mode = SolveMode.valueOf(cursor.getString(4)),
                createdAt = cursor.getLong(5),
                isSample = cursor.getInt(6) != 0,
                bookmarked = cursor.getInt(7) != 0
            ))
        }
    }

    fun saveDoubt(doubt: Doubt) {
        val values = ContentValues().apply {
            put("id", doubt.id)
            put("subject", doubt.subject.name)
            put("question", doubt.question)
            put("answer", doubt.answer)
            put("mode", doubt.mode.name)
            put("created_at", doubt.createdAt)
            put("is_sample", if (doubt.isSample) 1 else 0)
            put("bookmarked", if (doubt.bookmarked) 1 else 0)
        }
        writableDatabase.insertWithOnConflict("doubts", null, values, SQLiteDatabase.CONFLICT_REPLACE)
    }

    fun setBookmark(id: String, bookmarked: Boolean) {
        val values = ContentValues().apply { put("bookmarked", if (bookmarked) 1 else 0) }
        writableDatabase.update("doubts", values, "id = ?", arrayOf(id))
    }

    fun deleteDoubt(id: String) {
        writableDatabase.delete("doubts", "id = ?", arrayOf(id))
    }

    fun attempts(): List<PracticeAttempt> = readableDatabase.rawQuery(
        "SELECT id,question_id,subject,chapter,selected,correct,completed_at,next_review_at FROM attempts ORDER BY completed_at DESC", null
    ).use { cursor ->
        buildList {
            while (cursor.moveToNext()) add(PracticeAttempt(
                id = cursor.getString(0),
                questionId = cursor.getString(1),
                subject = Subject.valueOf(cursor.getString(2)),
                chapter = cursor.getString(3),
                selected = cursor.getInt(4),
                correct = cursor.getInt(5) != 0,
                completedAt = cursor.getLong(6),
                nextReviewAt = cursor.getLong(7)
            ))
        }
    }

    fun saveAttempt(attempt: PracticeAttempt) {
        val values = ContentValues().apply {
            put("id", attempt.id)
            put("question_id", attempt.questionId)
            put("subject", attempt.subject.name)
            put("chapter", attempt.chapter)
            put("selected", attempt.selected)
            put("correct", if (attempt.correct) 1 else 0)
            put("completed_at", attempt.completedAt)
            put("next_review_at", attempt.nextReviewAt)
        }
        writableDatabase.insertWithOnConflict("attempts", null, values, SQLiteDatabase.CONFLICT_REPLACE)
    }
}
