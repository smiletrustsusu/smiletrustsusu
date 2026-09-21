package com.kba.susu.secure

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters

/**
 * Optional WorkManager wake-up. Must only trigger the shared JS sync engine
 * (window.__SMILE_TRUST_BACKGROUND_SYNC__) — never reimplement money posting in Kotlin.
 */
class WorkManagerSyncWorker(
  appContext: Context,
  params: WorkerParameters
) : CoroutineWorker(appContext, params) {
  override suspend fun doWork(): Result {
    // Host Activity / Bridge should evaluate JS callback when WebView is alive.
    // If WebView is not running, enqueue a one-shot intent to open the app for sync.
    return Result.success()
  }
}
