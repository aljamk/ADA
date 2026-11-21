package si.adahack.zrak;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.util.Xml;
import android.view.View;
import android.widget.RemoteViews;

import org.json.JSONObject;
import org.xmlpull.v1.XmlPullParser;

import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.text.SimpleDateFormat;
import java.util.Calendar;
import java.util.Locale;
import java.util.TimeZone;

/**
 * Home-screen widget. Fetches the latest ARSO hourly reading for the station chosen in the app
 * and lets the user answer tomorrow's "Napovej jutri" question with one tap, without opening the app.
 *
 * Shared state lives in the SharedPreferences file "CapacitorStorage", which the web app writes
 * through @capacitor/preferences (keys: station, stationName, betTarget, betBucket, widgetBet).
 */
public class AirWidgetProvider extends AppWidgetProvider {

    private static final String ARSO_URL = "https://www.arso.gov.si/xml/zrak/ones_zrak_urni_podatki_zadnji.xml";
    private static final String PREFS = "CapacitorStorage";
    private static final String ACTION_BET = "si.adahack.zrak.BET";
    private static final String EXTRA_BUCKET = "bucket";

    private static final String[] BUCKET_KEYS = {"dober", "zmeren", "slab"};
    private static final String[] BUCKET_LABELS = {"Dober", "Zmeren", "Slab"};
    private static final int[] BUTTON_IDS = {R.id.bet_dober, R.id.bet_zmeren, R.id.bet_slab};

    // EEA PM2.5 bands, same as src/arso.ts
    private static final int[] LEVEL_MIN = {0, 5, 15, 50, 90, 140};
    private static final String[] LEVEL_LABEL = {"Dober", "Sprejemljiv", "Zmeren", "Slab", "Zelo slab", "Izjemno slab"};
    private static final int[] LEVEL_COLOR = {0xFF50F0E6, 0xFF50CCAA, 0xFFF0E641, 0xFFFF5050, 0xFF960032, 0xFF7D2181};

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

    @Override
    public void onReceive(Context ctx, Intent intent) {
        super.onReceive(ctx, intent);
        if (!ACTION_BET.equals(intent.getAction())) return;
        String bucket = intent.getStringExtra(EXTRA_BUCKET);
        if (bucket == null) return;
        SharedPreferences p = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        String target = tomorrow8();
        if (hasBet(p, target)) return;
        try {
            JSONObject bet = new JSONObject();
            bet.put("station", station(ctx));
            bet.put("stationName", p.getString("stationName", ""));
            bet.put("target", target);
            bet.put("bucket", bucket);
            // The app picks this up on next launch/resume and adds it to the game
            p.edit().putString("widgetBet", bet.toString()).apply();
        } catch (Exception ignored) {
        }
        updateAll(ctx);
    }

    /** Called from the app (WidgetBridge plugin) when the station or bet changes. */
    static void updateAll(Context ctx) {
        AppWidgetManager mgr = AppWidgetManager.getInstance(ctx);
        int[] ids = mgr.getAppWidgetIds(new ComponentName(ctx, AirWidgetProvider.class));
        if (ids.length == 0) return;
        new Thread(() -> render(ctx, mgr, ids, fetch(station(ctx)))).start();
    }

    private static String station(Context ctx) {
        return ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString("station", "E403");
    }

    private static String tomorrow8() {
        Calendar c = Calendar.getInstance(TimeZone.getTimeZone("Europe/Ljubljana"));
        c.add(Calendar.DAY_OF_MONTH, 1);
        SimpleDateFormat f = new SimpleDateFormat("yyyy-MM-dd", Locale.ROOT);
        f.setTimeZone(c.getTimeZone());
        return f.format(c.getTime()) + " 08:00";
    }

    /** Bet for tomorrow placed in the app (betTarget/betBucket) or in the widget (widgetBet)? Returns its bucket. */
    private static String betBucket(SharedPreferences p, String target) {
        if (target.equals(p.getString("betTarget", ""))) return p.getString("betBucket", null);
        try {
            JSONObject w = new JSONObject(p.getString("widgetBet", "{}"));
            if (target.equals(w.optString("target"))) return w.optString("bucket");
        } catch (Exception ignored) {
        }
        return null;
    }

    private static boolean hasBet(SharedPreferences p, String target) {
        return betBucket(p, target) != null;
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

    private static void render(Context ctx, AppWidgetManager mgr, int[] ids, Reading r) {
        SharedPreferences p = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        RemoteViews v = new RemoteViews(ctx.getPackageName(), R.layout.widget_air);

        if (r == null || r.pm25 == null) {
            v.setTextViewText(R.id.station, p.getString("stationName", "Zrak"));
            v.setTextViewText(R.id.value, "–");
            v.setTextViewText(R.id.level, r == null ? "Ni povezave z ARSO" : "Postaja ne meri PM2.5");
            v.setInt(R.id.dot, "setColorFilter", 0xFF5B7380);
        } else {
            int lvl = 0;
            for (int i = 0; i < LEVEL_MIN.length; i++) if (r.pm25 >= LEVEL_MIN[i]) lvl = i;
            v.setTextViewText(R.id.station, r.name);
            v.setTextViewText(R.id.value, String.valueOf(Math.round(r.pm25)));
            v.setTextViewText(R.id.level, LEVEL_LABEL[lvl] + " · meritev ARSO " + r.from.substring(Math.max(0, r.from.length() - 5)));
            v.setInt(R.id.dot, "setColorFilter", LEVEL_COLOR[lvl]);
        }

        // Tomorrow's bet: three buttons, or the answer already given
        String bucket = betBucket(p, tomorrow8());
        if (bucket != null) {
            String label = bucket;
            for (int i = 0; i < BUCKET_KEYS.length; i++) if (BUCKET_KEYS[i].equals(bucket)) label = BUCKET_LABELS[i];
            v.setTextViewText(R.id.question, "✔ Jutri 8h: " + label + " · razreši se ob ~9:45");
            v.setViewVisibility(R.id.buttons, View.GONE);
        } else {
            v.setTextViewText(R.id.question, "Jutri ob 8h bo zrak…");
            v.setViewVisibility(R.id.buttons, View.VISIBLE);
            for (int i = 0; i < BUCKET_KEYS.length; i++) {
                Intent bet = new Intent(ctx, AirWidgetProvider.class).setAction(ACTION_BET).putExtra(EXTRA_BUCKET, BUCKET_KEYS[i]);
                v.setOnClickPendingIntent(BUTTON_IDS[i], PendingIntent.getBroadcast(ctx, i + 1, bet,
                        PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE));
            }
        }

        // Tap anywhere else opens the app
        Intent open = new Intent(ctx, MainActivity.class);
        v.setOnClickPendingIntent(R.id.root, PendingIntent.getActivity(ctx, 0, open,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE));

        for (int id : ids) mgr.updateAppWidget(id, v);
    }
}
