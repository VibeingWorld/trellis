package com.vibeingworld.cove

import android.appwidget.AppWidgetManager
import android.content.Context
import android.content.SharedPreferences
import android.widget.RemoteViews
import es.antonborri.home_widget.HomeWidgetLaunchIntent
import es.antonborri.home_widget.HomeWidgetProvider

class CoveColumnWidgetProvider : HomeWidgetProvider() {
  override fun onUpdate(
    context: Context,
    appWidgetManager: AppWidgetManager,
    appWidgetIds: IntArray,
    widgetData: SharedPreferences,
  ) {
    appWidgetIds.forEach { widgetId ->
      val views = RemoteViews(context.packageName, R.layout.cove_column_widget).apply {
        setTextViewText(R.id.widget_board, widgetData.getString("board_name", null) ?: "Cove")
        setTextViewText(R.id.widget_column, widgetData.getString("column_name", null) ?: "Choose a column in the app")
        setTextViewText(R.id.widget_count, widgetData.getString("card_count", "0") ?: "0")
        setTextViewText(R.id.widget_cards, widgetData.getString("card_list", null) ?: "Open Cove to select a board column")
        setOnClickPendingIntent(
          R.id.widget_container,
          HomeWidgetLaunchIntent.getActivity(context, MainActivity::class.java),
        )
      }
      appWidgetManager.updateAppWidget(widgetId, views)
    }
  }
}
