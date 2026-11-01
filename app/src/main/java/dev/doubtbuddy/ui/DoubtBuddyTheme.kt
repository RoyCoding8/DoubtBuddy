package dev.doubtbuddy.ui

import android.app.Activity
import android.os.Build
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.dynamicDarkColorScheme
import androidx.compose.material3.dynamicLightColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.SideEffect
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.core.view.WindowCompat

private val light = lightColorScheme(
    primary = Color(0xFF445D9D),
    onPrimary = Color.White,
    primaryContainer = Color(0xFFDCE3FF),
    onPrimaryContainer = Color(0xFF182D64),
    secondary = Color(0xFF586179),
    secondaryContainer = Color(0xFFDDE2F9),
    tertiary = Color(0xFF735573),
    background = Color(0xFFF9F9FF),
    surface = Color(0xFFF9F9FF),
    surfaceVariant = Color(0xFFE3E5EF),
    outlineVariant = Color(0xFFC5C6D0)
)

private val dark = darkColorScheme(
    primary = Color(0xFFB4C5FF),
    onPrimary = Color(0xFF132E67),
    primaryContainer = Color(0xFF2C467F),
    secondary = Color(0xFFC0C6DD),
    background = Color(0xFF10131B),
    surface = Color(0xFF10131B),
    surfaceVariant = Color(0xFF444651),
    outlineVariant = Color(0xFF444651)
)

@Composable
fun DoubtBuddyTheme(content: @Composable () -> Unit) {
    val night = isSystemInDarkTheme()
    val context = LocalContext.current
    val scheme = when {
        Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && night -> dynamicDarkColorScheme(context)
        Build.VERSION.SDK_INT >= Build.VERSION_CODES.S -> dynamicLightColorScheme(context)
        night -> dark
        else -> light
    }
    SideEffect {
        (context as? Activity)?.window?.let { window ->
            WindowCompat.getInsetsController(window, window.decorView).apply {
                isAppearanceLightStatusBars = !night
                isAppearanceLightNavigationBars = !night
            }
        }
    }
    MaterialTheme(colorScheme = scheme, content = content)
}
