package com.papercache.mobile.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

private val LightColors = lightColorScheme(
    primary = Color(0xFF3F51B5),
    onPrimary = Color.White,
    secondary = Color(0xFF536DFE),
    background = Color(0xFFFAFAFA),
    surface = Color(0xFFFFFFFF),
)

@Composable
fun PaperCacheTheme(content: @Composable () -> Unit) {
    MaterialTheme(colorScheme = LightColors, content = content)
}
