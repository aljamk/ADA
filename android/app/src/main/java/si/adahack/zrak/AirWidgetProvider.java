package si.adahack.zrak;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.util.Xml;
import android.widget.RemoteViews;

import org.xmlpull.v1.XmlPullParser;

import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.text.SimpleDateFormat;
import java.util.Calendar;
import java.util.Locale;
import java.util.TimeZone;

/**
 * Home-screen widget: the latest ARSO hourly PM2.5 for the station chosen in the app, the level
 * word and the value, and Golob, the pigeon mascot. Golob gets red eyes while today's tasks in
 * the Igra tab are not all done.
 *
 * Shared state lives in the SharedPreferences file "CapacitorStorage", which the web app writes
 * through @capacitor/preferences (keys: station, stationName, tasksDone, tasksDay).
 */
public class AirWidgetProvider extends AppWidgetProvider {

    private static final String ARSO_URL = "https://www.arso.gov.si/xml/zrak/ones_zrak_urni_podatki_zadnji.xml";
    private static final String PREFS = "CapacitorStorage";
    private static final int TASKS_TOTAL = 4;

    // US EPA AQI breakpoints for PM2.5 (2024), the same levels and colours as src/aqi.ts
    private static final double[] LEVEL_MAX = {9.0, 35.4, 55.4, 125.4, Double.MAX_VALUE};
    private static final String[] LEVEL_LABEL = {"Dobro", "Zmerno", "Slabo", "Zelo slabo", "Nevarno"};
    private static final int[] LEVEL_COLOR = {0xFF3BB273, 0xFFF2C94C, 0xFFF2994A, 0xFFE5484D, 0xFF8E4EC6};

    static class Reading {
        String name = "";
        String from = "";
        Double pm25 = null;
    }

    @Override
    public void onUpdate(Context ctx, AppWidgetManager mgr, int[] ids) {
        final PendingResult pending = goAsync();
        new Thread(() -> {
            try {
                render(ctx, mgr, ids, fetch(station(ctx)));
            } finally {
                pending.finish();
            }
        }).start();
    }

    /** Called from the app (WidgetBridge plugin) when the station or the tasks change. */
    static void updateAll(Context ctx) {
        AppWidgetManager mgr = AppWidgetManager.getInstance(ctx);
        int[] ids = mgr.getAppWidgetIds(new ComponentName(ctx, AirWidgetProvider.class));
        if (ids.length == 0) return;
        new Thread(() -> render(ctx, mgr, ids, fetch(station(ctx)))).start();
    }

    private static String station(Context ctx) {
        return ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString("station", "E403");
    }

    private static String today() {
        Calendar c = Calendar.getInstance(TimeZone.getTimeZone("Europe/Ljubljana"));
        SimpleDateFormat f = new SimpleDateFormat("yyyy-MM-dd", Locale.ROOT);
        f.setTimeZone(c.getTimeZone());
        return f.format(c.getTime());
    }

    /** Tasks done today in the app (0 if the stored day is not today). Capacitor stores strings as JSON. */
    private static int tasksDone(SharedPreferences p) {
        String day = p.getString("tasksDay", "").replace("\"", "");
        if (!today().equals(day)) return 0;
        try {
            return Integer.parseInt(p.getString("tasksDone", "0").replace("\"", "").trim());
        } catch (Exception e) {
            return 0;
        }
    }

    private static Reading fetch(String code) {
        Reading r = new Reading();
        HttpURLConnection con = null;
        try {
            con = (HttpURLConnection) new URL(ARSO_URL).openConnection();
            con.setConnectTimeout(10000);
            con.setReadTimeout(10000);
            InputStream in = con.getInputStream();
            XmlPullParser x = Xml.newPullParser();
            x.setInput(in, "UTF-8");
            boolean mine = false;
            for (int ev = x.getEventType(); ev != XmlPullParser.END_DOCUMENT; ev = x.next()) {
                if (ev == XmlPullParser.START_TAG) {
                    String tag = x.getName();
                    if ("postaja".equals(tag)) mine = code.equals(x.getAttributeValue(null, "sifra"));
                    else if (mine && "merilno_mesto".equals(tag)) r.name = x.nextText();
                    else if (mine && "datum_od".equals(tag)) r.from = x.nextText();
                    else if (mine && "pm2.5".equals(tag)) {
                        String t = x.nextText().replace("<", "").trim();
                        if (!t.isEmpty()) r.pm25 = Double.parseDouble(t);
                    }
                } else if (ev == XmlPullParser.END_TAG && mine && "postaja".equals(x.getName())) {
                    break;
                }
            }
        } catch (Exception e) {
            r = null;
        } finally {
            if (con != null) con.disconnect();
        }
        return r;
    }

    private static String shortName(String name) {
        return name.replace("LJ ", "").replace("MB ", "").replace("CE ", "").trim();
    }

    private static void render(Context ctx, AppWidgetManager mgr, int[] ids, Reading r) {
        SharedPreferences p = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        RemoteViews v = new RemoteViews(ctx.getPackageName(), R.layout.widget_air);
        String info;

        if (r == null || r.pm25 == null) {
            v.setTextViewText(R.id.level, r == null ? "Ni povezave" : "Ni meritve");
            v.setTextViewText(R.id.value, "–");
            info = (r == null ? "ARSO trenutno ni dosegljiv" : "Postaja ne meri PM2,5") + " · " + p.getString("stationName", "Zrak").replace("\"", "");
            v.setInt(R.id.dot, "setColorFilter", 0xFF5D7168);
        } else {
            int lvl = 0;
            while (lvl < LEVEL_MAX.length - 1 && r.pm25 > LEVEL_MAX[lvl]) lvl++;
            v.setTextViewText(R.id.level, LEVEL_LABEL[lvl].toUpperCase(Locale.ROOT));
            v.setTextViewText(R.id.value, Math.round(r.pm25) + " µg/m³");
            String time = r.from.length() >= 5 ? r.from.substring(r.from.length() - 5) : "";
            info = "● MERITEV · " + shortName(r.name) + " · " + time;
            v.setInt(R.id.dot, "setColorFilter", LEVEL_COLOR[lvl]);
        }

        // Golob: red eyes while today's tasks wait
        int done = tasksDone(p);
        int left = TASKS_TOTAL - done;
        if (left <= 0) {
            v.setImageViewResource(R.id.golob, R.drawable.golob);
            info += " · Naloge opravljene";
        } else {
            v.setImageViewResource(R.id.golob, R.drawable.golob_rdece);
            String n = left == 1 ? "še 1 naloga" : left == 2 ? "še 2 nalogi" : "še " + left + " naloge";
            info += " · Golob čaka: " + n;
        }

        v.setTextViewText(R.id.info, info);

        // Tap opens the app
        Intent open = new Intent(ctx, MainActivity.class);
        v.setOnClickPendingIntent(R.id.root, PendingIntent.getActivity(ctx, 0, open,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE));

        for (int id : ids) mgr.updateAppWidget(id, v);
    }
}
