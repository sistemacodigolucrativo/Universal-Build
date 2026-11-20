package com.universalbuild.smoketest;
import android.app.Activity;
import android.os.Bundle;
import android.widget.TextView;
public final class MainActivity extends Activity {
  @Override public void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    TextView view = new TextView(this);
    view.setText("Universal Build: compilação Android verificada.");
    view.setTextSize(20);
    view.setPadding(30, 50, 30, 30);
    setContentView(view);
  }
}
