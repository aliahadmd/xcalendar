import { WidgetTaskHandlerProps } from "react-native-android-widget";
import { renderUpNextWidget } from "@/widget/up-next";

export default async function widgetTaskHandler(props: WidgetTaskHandlerProps) {
  const widgetInfo = props.widgetInfo;

  switch (props.widgetAction) {
    case "WIDGET_ADDED":
    case "WIDGET_UPDATE":
    case "WIDGET_RESIZED":
      await renderUpNextWidget({
        renderWidget: props.renderWidget,
        widgetInfo,
        large: widgetInfo.widgetName === "UpNextWidgetLarge" || widgetInfo.width > 500,
      });
      break;
    case "WIDGET_DELETED":
    case "WIDGET_CLICK":
      break;
  }
}
