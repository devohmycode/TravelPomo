package com.pomo.focustimer;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import com.pomo.focustimer.plugin.PomoTimerPlugin;
import com.pomo.focustimer.plugin.ProPurchasePlugin;
import com.pomo.focustimer.plugin.DynamicColorsPlugin;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(PomoTimerPlugin.class);
        registerPlugin(ProPurchasePlugin.class);
        registerPlugin(DynamicColorsPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
