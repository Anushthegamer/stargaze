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

        // Let the platform turn the rotation vector into orientation angles.
        // getRotationMatrixFromVector + getOrientation is the same pair every
        // Android compass app uses; deriving the heading by hand from the
        // quaternion means re-deriving axis conventions the framework already
        // knows, and getting them subtly wrong.
        //
        // Some devices report a 5-element vector (a heading-accuracy estimate
        // in values[4]), which getRotationMatrixFromVector rejects -- so copy
        // the first four rather than passing event.values straight through.
        float[] vector = new float[4];
        System.arraycopy(event.values, 0, vector, 0, Math.min(4, event.values.length));

        float[] matrix = new float[9];
        SensorManager.getRotationMatrixFromVector(matrix, vector);

        float[] orientation = new float[3];
        SensorManager.getOrientation(matrix, orientation);

        // Reported in the device's natural frame, exactly as the web
        // DeviceOrientation event is: the display rotation is applied on the
        // JavaScript side, which already tracks it, so remapping here would
        // apply it twice.
        JSObject data = new JSObject();
        data.put("azimuth", Math.toDegrees(orientation[0])); // clockwise from magnetic north
        data.put("pitch", Math.toDegrees(orientation[1]));
        data.put("roll", Math.toDegrees(orientation[2]));
        // Heading accuracy in radians where the device estimates one; -1 means
        // it does not, passed through rather than guessed at here.
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
