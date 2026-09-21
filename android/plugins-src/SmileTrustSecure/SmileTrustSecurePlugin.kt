package com.kba.susu.secure

import android.app.Activity
import android.view.WindowManager
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.getcapacitor.JSObject

/**
 * Wave 4 thin Capacitor bridge — NOT a full Compose app rewrite.
 * Optional: merge into android/ after `npm run cap:add:android`.
 */
@CapacitorPlugin(name = "SmileTrustSecure")
class SmileTrustSecurePlugin : Plugin() {

  @PluginMethod
  fun setScreenshotProtection(call: PluginCall) {
    val enabled = call.getBoolean("enabled", true) ?: true
    val activity: Activity = activity ?: run {
      call.reject("Activity unavailable")
      return
    }
    activity.runOnUiThread {
      if (enabled) {
        activity.window.setFlags(
          WindowManager.LayoutParams.FLAG_SECURE,
          WindowManager.LayoutParams.FLAG_SECURE
        )
      } else {
        activity.window.clearFlags(WindowManager.LayoutParams.FLAG_SECURE)
      }
      val ret = JSObject()
      ret.put("enabled", enabled)
      call.resolve(ret)
    }
  }

  @PluginMethod
  fun bluetoothPrint(call: PluginCall) {
    // Stub path for Bluetooth ESC/POS printers — wire vendor SDK in pilot.
    val text = call.getString("text") ?: ""
    val ret = JSObject()
    ret.put("queued", text.isNotEmpty())
    ret.put("stub", true)
    call.resolve(ret)
  }

  @PluginMethod
  fun isAvailable(call: PluginCall) {
    val ret = JSObject()
    ret.put("available", false)
    ret.put("reason", "Use NativeBiometric plugin when configured")
    call.resolve(ret)
  }
}
