package com.papercache.mobile.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Typography
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp
import com.papercache.mobile.R

/** JetBrains Mono — matches the desktop PaperCache font. */
val JetBrainsMono = FontFamily(
    Font(R.font.jetbrainsmono_regular, FontWeight.Normal),
    Font(R.font.jetbrainsmono_medium, FontWeight.Medium),
    Font(R.font.jetbrainsmono_bold, FontWeight.Bold),
)

// PaperCache "Paper Light" palette, matching the desktop app:
//   background #fdfdfd, text #2c2c2c, muted #6b6375, border #e5e4e7,
//   code bg #f4f3ec, accent #aa3bff.
val PaperLightColors = lightColorScheme(
    primary = Color(0xFFAA3BFF),
    onPrimary = Color(0xFFFFFFFF),
    primaryContainer = Color(0x1AAA3BFF),
    onPrimaryContainer = Color(0xFF2C2C2C),
    secondary = Color(0xFF6B6375),
    onSecondary = Color(0xFFFFFFFF),
    background = Color(0xFFFDFDFD),
    onBackground = Color(0xFF2C2C2C),
    surface = Color(0xFFFFFFFF),
    onSurface = Color(0xFF2C2C2C),
    surfaceVariant = Color(0xFFF4F3EC),
    onSurfaceVariant = Color(0xFF6B6375),
    outline = Color(0xFFE5E4E7),
    outlineVariant = Color(0xFFE5E4E7),
    error = Color(0xFFB3261E),
    errorContainer = Color(0xFFF9DEDC),
    onErrorContainer = Color(0xFF410E0B),
)

// PaperCache "Grid Dark" palette.
val PaperDarkColors = darkColorScheme(
    primary = Color(0xFFC084FC),
    onPrimary = Color(0xFF1A1A1A),
    background = Color(0xFF1A1A1A),
    onBackground = Color(0xFFE0E0E0),
    surface = Color(0xFF16171D),
    onSurface = Color(0xFFE0E0E0),
    surfaceVariant = Color(0xFF1F2028),
    onSurfaceVariant = Color(0xFF9CA3AF),
    outline = Color(0xFF2E303A),
)

private val PaperTypography = Typography(
    bodyLarge = TextStyle(fontFamily = JetBrainsMono, fontSize = 16.sp, lineHeight = 24.sp),
    bodyMedium = TextStyle(fontFamily = JetBrainsMono, fontSize = 14.sp, lineHeight = 20.sp),
    bodySmall = TextStyle(fontFamily = JetBrainsMono, fontSize = 13.sp, lineHeight = 18.sp),
    titleLarge = TextStyle(
        fontFamily = JetBrainsMono,
        fontSize = 20.sp,
        lineHeight = 26.sp,
        fontWeight = FontWeight.Medium,
    ),
    titleMedium = TextStyle(
        fontFamily = JetBrainsMono,
        fontSize = 16.sp,
        lineHeight = 22.sp,
        fontWeight = FontWeight.Medium,
    ),
    titleSmall = TextStyle(
        fontFamily = JetBrainsMono,
        fontSize = 14.sp,
        fontWeight = FontWeight.Medium,
    ),
    labelLarge = TextStyle(fontFamily = JetBrainsMono, fontSize = 14.sp, fontWeight = FontWeight.Medium),
    labelMedium = TextStyle(fontFamily = JetBrainsMono, fontSize = 13.sp),
    labelSmall = TextStyle(fontFamily = JetBrainsMono, fontSize = 12.sp),
)

@Composable
fun PaperCacheTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = PaperLightColors,
        typography = PaperTypography,
        content = content,
    )
}
