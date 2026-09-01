package app.stargaze.sky;

import android.content.Context;
import android.hardware.Sensor;
import android.hardware.SensorEvent;
import android.hardware.SensorEventListener;
import android.hardware.SensorManager;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Android's TYPE_ROTATION_VECTOR fuses gyroscope, accelerometer and
 * magnetometer in hardware -- steadier than reconstructing orientation from
 * the browser's DeviceOrientationEvent Euler angles in JavaScript. Streams
 * straight into basisFromQuaternion() in
 * packages/core/src/orientation.ts, which already documents accepting
 * exactly this sensor's East-North-Up quaternion with no axis remapping.
 *
 * Built to Android's documented SensorEvent contract for this sensor type,
 * not verified against a physical device -- there is no way to do that from
 * here. Treat it as a starting point for field testing, not a settled fact.
 */
@CapacitorPlugin(name = "RotationVector")
public class RotationVectorPlugin extends Plugin implements SensorEventListener {

    private SensorManager sensorManager;
    private Sensor rotationVectorSensor;

    @Override
    public void load() {
        sensorManager = (SensorManager) getContext().getSystemService(Context.SENSOR_SERVICE);
        rotationVectorSensor = sensorManager.getDefaultSensor(Sensor.TYPE_ROTATION_VECTOR);
    }

    @PluginMethod
    public void isAvailable(PluginCall call) {
        JSObject result = new JSObject();
        result.put("available", rotationVectorSensor != null);
        call.resolve(result);
    }

    @PluginMethod
    public void start(PluginCall call) {
        if (rotationVectorSensor == null) {
            call.reject("No TYPE_ROTATION_VECTOR sensor on this device.");
            return;
        }
        sensorManager.registerListener(this, rotationVectorSensor, SensorManager.SENSOR_DELAY_GAME);
        call.resolve();
    }

    @Override
    public void onSensorChanged(SensorEvent event) {
        if (event.sensor.getType() != Sensor.TYPE_ROTATION_VECTOR) return;

        float x = event.values[0];
        float y = event.values[1];
        float z = event.values[2];
        // Some devices omit the scalar component; reconstruct it rather than
        // assume a fourth element is always present.
        float w = event.values.length > 3
            ? event.values[3]
            : (float) Math.sqrt(Math.max(0.0, 1.0 - x * x - y * y - z * z));

        JSObject data = new JSObject();
        data.put("x", x);
        data.put("y", y);
        data.put("z", z);
        data.put("w", w);
        // Estimated heading accuracy in radians where the device reports one;
        // -1 means "not available", passed through for the caller to
        // interpret rather than guessed at here.
        data.put("accuracy", event.values.length > 4 ? event.values[4] : -1.0);

        notifyListeners("reading", data);
    }

    @Override
    public void onAccuracyChanged(Sensor sensor, int accuracy) {}

    @Override
    protected void handleOnDestroy() {
        if (sensorManager != null) sensorManager.unregisterListener(this);
        super.handleOnDestroy();
    }
}
