package expo.modules.xcalendaralarm

import android.app.Activity
import android.content.Context
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.media.AudioAttributes
import android.media.MediaPlayer
import android.media.RingtoneManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.os.VibrationEffect
import android.os.Vibrator
import android.view.Gravity
import android.view.View
import android.view.WindowManager
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * Full-screen alarm: shows over the lock screen, turns the display on,
 * plays the alarm sound and vibrates until dismissed.
 */
class XAlarmActivity : Activity() {
    private var player: MediaPlayer? = null
    private var vibrator: Vibrator? = null
    private val handler = Handler(Looper.getMainLooper())

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true)
            setTurnScreenOn(true)
        } else {
            @Suppress("DEPRECATION")
            window.addFlags(
                WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED
                    or WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON
            )
        }
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)

        val title = intent.getStringExtra("title") ?: "Reminder"
        val body = intent.getStringExtra("body") ?: ""

        setContentView(buildUi(title, body))
        startAlarmSignals()
    }

    private fun dp(v: Int): Int = (v * resources.displayMetrics.density).toInt()

    private fun buildUi(title: String, body: String): View {
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            setBackgroundColor(Color.parseColor("#0A0A0C"))
            setPadding(dp(28), dp(48), dp(28), dp(48))
        }

        val time = TextView(this).apply {
            text = SimpleDateFormat("HH:mm", Locale.getDefault()).format(Date())
            setTextColor(Color.parseColor("#FF453A"))
            textSize = 15f
            typeface = Typeface.create("sans-serif-medium", Typeface.BOLD)
            letterSpacing = 0.2f
            gravity = Gravity.CENTER
        }

        val bell = TextView(this).apply {
            text = "⏰"
            textSize = 52f
            gravity = Gravity.CENTER
            setPadding(0, dp(24), 0, dp(16))
        }

        val titleView = TextView(this).apply {
            text = title
            setTextColor(Color.WHITE)
            textSize = 30f
            typeface = Typeface.create("sans-serif-medium", Typeface.NORMAL)
            gravity = Gravity.CENTER
        }

        val bodyView = TextView(this).apply {
            text = body.ifEmpty { "Scheduled reminder" }
            setTextColor(Color.parseColor("#9A9AA3"))
            textSize = 16f
            gravity = Gravity.CENTER
            setPadding(0, dp(10), 0, 0)
        }

        val doneBtn = Button(this).apply {
            text = "✓  Done"
            textSize = 17f
            typeface = Typeface.create("sans-serif-medium", Typeface.BOLD)
            setTextColor(Color.WHITE)
            background = GradientDrawable().apply {
                shape = GradientDrawable.RECTANGLE
                cornerRadius = dp(16).toFloat()
                setColor(Color.parseColor("#FF453A"))
            }
            setPadding(0, dp(16), 0, dp(16))
            setOnClickListener { finish() }
        }

        val snoozeBtn = Button(this).apply {
            text = "Snooze 10 min"
            textSize = 16f
            setTextColor(Color.parseColor("#0A84FF"))
            background = GradientDrawable().apply {
                shape = GradientDrawable.RECTANGLE
                cornerRadius = dp(16).toFloat()
                setColor(Color.parseColor("#1C1C1E"))
            }
            setPadding(0, dp(15), 0, dp(15))
            setOnClickListener {
                XAlarmScheduler.snooze(
                    this@XAlarmActivity,
                    title,
                    body,
                    intent.getStringExtra("kind") ?: "reminder",
                    10,
                )
                finish()
            }
        }

        root.addView(time)
        root.addView(bell)
        root.addView(titleView)
        root.addView(bodyView)

        val buttons = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(40), dp(40), dp(40), 0)
        }
        buttons.addView(doneBtn)
        buttons.addView(snoozeBtn)
        root.addView(buttons)
        return root
    }

    private fun startAlarmSignals() {
        try {
            val alarmUri: Uri =
                RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)
                    ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)
            player = MediaPlayer().apply {
                setDataSource(this@XAlarmActivity, alarmUri)
                setAudioAttributes(
                    AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_ALARM)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .build()
                )
                isLooping = true
                prepare()
                start()
            }
        } catch (e: Exception) {
            // ringtone failed — vibration still runs
        }
        try {
            vibrator = getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                vibrator?.vibrate(
                    VibrationEffect.createWaveform(longArrayOf(0, 500, 600), 0),
                )
            } else {
                @Suppress("DEPRECATION")
                vibrator?.vibrate(longArrayOf(0, 500, 600), 0)
            }
        } catch (e: Exception) {
            // no vibrator
        }
        // stop automatically after 2 minutes if untouched
        handler.postDelayed({ if (!isFinishing) finish() }, 2 * 60_000L)
    }

    private fun stopAlarmSignals() {
        try {
            player?.stop()
            player?.release()
        } catch (e: Exception) {
        }
        player = null
        vibrator?.cancel()
    }

    override fun onDestroy() {
        stopAlarmSignals()
        super.onDestroy()
    }
}
