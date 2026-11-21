package si.adahack.zrak;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** Lets the web app ask the home-screen widget to refresh (src/native.ts → WidgetBridge.reload()). */
@CapacitorPlugin(name = "WidgetBridge")
public class WidgetBridgePlugin extends Plugin {
    @PluginMethod
    public void reload(PluginCall call) {
        AirWidgetProvider.updateAll(getContext());
        call.resolve();
    }
}
