package dev.advay.mayday

import android.content.Context
import android.media.AudioManager
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel

/**
 * Answers one question for the Dart side: is a call up right now?
 *
 * It matters because an ordinary app cannot capture microphone audio while a
 * call is active, and Android does not say so. `AudioRecord.startRecording()`
 * succeeds during a call and then delivers digital silence — no exception, no
 * error code — so a voice feature that does not check this looks alive and is
 * deaf. See research/DECISIONS.md D1 and
 * developer.android.com/media/platform/sharing-audio-input.
 *
 * `AudioManager.getMode()` is the cheapest honest signal: MODE_IN_CALL for a
 * cellular call, MODE_IN_COMMUNICATION for VoIP, and it needs no permission —
 * deliberately, because Mayday should not have to ask for READ_PHONE_STATE to
 * know whether it can hear.
 */
class MainActivity : FlutterActivity() {

    private companion object {
        const val CHANNEL = "dev.advay.mayday/audio"
    }

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)

        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, CHANNEL)
            .setMethodCallHandler { call, result ->
                when (call.method) {
                    "isCallActive" -> result.success(isCallActive())
                    else -> result.notImplemented()
                }
            }
    }

    private fun isCallActive(): Boolean {
        val audio = getSystemService(Context.AUDIO_SERVICE) as? AudioManager
            ?: return false
        return audio.mode == AudioManager.MODE_IN_CALL ||
            audio.mode == AudioManager.MODE_IN_COMMUNICATION
    }
}
