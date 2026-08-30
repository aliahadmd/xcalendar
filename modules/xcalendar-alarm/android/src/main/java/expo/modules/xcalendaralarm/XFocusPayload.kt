package expo.modules.xcalendaralarm

import org.json.JSONObject

/**
 * The one place that knows HyperOS 3's Super Island payload format
 * (dev.mi.com focus-notification spec, protocol 3 / param_v2), matched
 * field-for-field to the empirically working HyperIsland-ToolKit models.
 *
 * Both surfaces share it:
 *  - [alarmV3Param]   — alarm reminders (islandFirstFloat = true)
 *  - [islandV3Param]  — persistent "next event" island (islandFirstFloat = false,
 *                       big-island left/right areas, AOD title)
 *
 * miui.focus.param is limited to 3072 bytes — all text is clipped.
 */
object XFocusPayload {
    const val ISLAND_PIC = "miui.focus.pic_island"

    fun clip(s: String?, n: Int): String {
        val v = (s ?: "").trim()
        return if (v.length <= n) v else v.take(n - 1) + "…"
    }

    private fun leftArea(title: String, content: String): JSONObject =
        JSONObject()
            .put("type", 1)
            .put("picInfo", JSONObject().put("type", 1).put("pic", ISLAND_PIC))
            .put(
                "textInfo",
                JSONObject()
                    .put("title", clip(title, 20))
                    .put("content", clip(content, 40))
                    .put("showHighlightColor", true),
            )

    private fun smallIslandArea(): JSONObject =
        JSONObject().put("picInfo", JSONObject().put("type", 1).put("pic", ISLAND_PIC))

    /**
     * Official HyperOS 3 Super Island payload (dev.mi.com), field-for-field
     * matched to the empirically working HyperIsland-ToolKit models:
     *   root:      { param_v2: {...}, isShowNotification: true }
     *   param_v2:  protocol=3, business, updatable, ticker, aodTitle,
     *              param_island → { islandProperty, islandPriority,
     *              bigIslandArea → imageTextInfoLeft → { type, picInfo, textInfo },
     *              smallIslandArea → { picInfo } }, baseInfo
     */
    fun alarmV3Param(title: String, body: String, updatable: Boolean): String {
        val paramIsland = JSONObject()
            .put("islandProperty", 1)
            .put("islandPriority", 2)
            .put("bigIslandArea", JSONObject().put("imageTextInfoLeft", leftArea(title, body)))
            .put("smallIslandArea", smallIslandArea())
        val paramV2 = JSONObject()
            .put("protocol", 3)
            .put("business", "xcalendar_alarm")
            .put("updatable", updatable)
            // OS3-only apps must pass ticker or the status-bar notification won't show.
            .put("ticker", clip(title, 20))
            .put("enableFloat", true)
            .put("isShowNotification", true)
            .put("islandFirstFloat", true)
            .put("aodTitle", clip(title, 20))
            .put("param_island", paramIsland)
            .put(
                "baseInfo",
                JSONObject().put("type", 1).put("title", clip(title, 30)).put("content", clip(body, 60)),
            )
        // Top-level wrapper shape used by the working toolkit.
        return JSONObject()
            .put("param_v2", paramV2)
            .put("isShowNotification", true)
            .toString()
    }

    /** Persistent "next event" island: pill → big island (event | countdown) → card. */
    fun islandV3Param(
        title: String,
        subtitle: String,
        content: String,
        subContent: String,
        extraTitle: String,
        ticker: String,
        aod: String,
    ): String {
        // Big island, left: app icon + event name + date/time.
        val leftText = JSONObject()
            .put("title", clip(title, 24))
            .put("content", clip(subtitle, 40))
            .put("showHighlightColor", true)
        val leftArea = JSONObject()
            .put("type", 1)
            .put("picInfo", JSONObject().put("type", 1).put("pic", ISLAND_PIC))
            .put("textInfo", leftText)
        // Big island, right: the live countdown.
        val rightText = JSONObject()
            .put("title", clip(content, 16))
            .put("showHighlightColor", true)
        val rightArea = JSONObject()
            .put("type", 1)
            .put("textInfo", rightText)
        val paramIsland = JSONObject()
            .put("islandProperty", 1)
            .put("islandPriority", 2)
            .put(
                "bigIslandArea",
                JSONObject().put("imageTextInfoLeft", leftArea).put("imageTextInfoRight", rightArea),
            )
            .put("smallIslandArea", smallIslandArea())
        // Notification card (baseInfo): label, event, date·time, countdown, next-up.
        val baseInfo = JSONObject()
            .put("type", 1)
            .put("extraTitle", clip(extraTitle, 20))
            .put("title", clip(title, 30))
            .put("subTitle", clip(subtitle, 30))
            .put("content", clip(content, 60))
        if (subContent.isNotBlank()) baseInfo.put("subContent", clip(subContent, 60))
        val paramV2 = JSONObject()
            .put("protocol", 3)
            .put("business", "xcalendar_next_event")
            .put("updatable", true)
            .put("ticker", clip(ticker, 40))
            .put("enableFloat", true)
            .put("isShowNotification", true)
            .put("islandFirstFloat", false)
            .put("aodTitle", clip(aod, 30))
            .put("param_island", paramIsland)
            .put("baseInfo", baseInfo)
        return JSONObject()
            .put("param_v2", paramV2)
            .put("isShowNotification", true)
            .toString()
    }
}
