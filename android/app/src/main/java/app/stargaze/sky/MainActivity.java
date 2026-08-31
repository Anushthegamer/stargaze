package app.stargaze.sky;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
  @Override
  public void onCreate(Bundle savedInstanceState) {
    registerPlugin(RotationVectorPlugin.class);
    super.onCreate(savedInstanceState);
  }
}
