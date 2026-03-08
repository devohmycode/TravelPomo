package com.pomo.focustimer.plugin

import android.os.Build
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin

@CapacitorPlugin(name = "DynamicColors")
class DynamicColorsPlugin : Plugin() {

    @PluginMethod
    fun getSystemColors(call: PluginCall) {
        val ret = JSObject()

        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) {
            ret.put("available", false)
            ret.put("colorA", "#1a3a5c")
            ret.put("colorB", "#e8a830")
            call.resolve(ret)
            return
        }

        try {
            val ctx = context
            val primary = ctx.getColor(android.R.color.system_accent1_500)
            val tertiary = ctx.getColor(android.R.color.system_accent3_500)

            ret.put("available", true)
            ret.put("colorA", colorToHex(primary))
            ret.put("colorB", colorToHex(tertiary))
            call.resolve(ret)
        } catch (e: Exception) {
            ret.put("available", false)
            ret.put("colorA", "#1a3a5c")
            ret.put("colorB", "#e8a830")
            call.resolve(ret)
        }
    }

    private fun colorToHex(color: Int): String {
        val r = (color shr 16) and 0xFF
        val g = (color shr 8) and 0xFF
        val b = color and 0xFF
        return String.format("#%02x%02x%02x", r, g, b)
    }
}
