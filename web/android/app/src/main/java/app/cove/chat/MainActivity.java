package app.cove.chat;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.plugins.localnotifications.LocalNotifications;

public class MainActivity extends BridgeActivity {
  @Override
  public void onCreate(Bundle savedInstanceState) {
    registerPlugin(LocalNotifications.class);
    super.onCreate(savedInstanceState);
  }
}
