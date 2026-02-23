package com.pomo.focustimer;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import com.pomo.focustimer.plugin.PomoTimerPlugin;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(PomoTimerPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
