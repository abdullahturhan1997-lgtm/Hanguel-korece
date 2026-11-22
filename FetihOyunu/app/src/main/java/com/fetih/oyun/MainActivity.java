package com.fetih.oyun;

import android.app.Activity;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.speech.tts.TextToSpeech;
import android.view.View;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import java.util.Locale;

/** Fetih oyununun Android sarmalayıcısı: oyun çevrimdışı olarak assets/index.html içinde çalışır. */
public class MainActivity extends Activity {
    private static final String HOME = "file:///android_asset/index.html";
    private WebView webView;
    private TextToSpeech tts;
    private boolean ttsReady = false;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        webView = new WebView(this);
        webView.setBackgroundColor(Color.rgb(90, 174, 216));

        WebSettings s = webView.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true); // oyun kaydı localStorage'da tutulur
        s.setDefaultTextEncodingName("UTF-8");
        s.setAllowFileAccess(true);
        s.setAllowFileAccessFromFileURLs(false);
        s.setAllowUniversalAccessFromFileURLs(false);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setJavaScriptCanOpenWindowsAutomatically(false);
        s.setSupportMultipleWindows(false);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);

        // Köprü güvenlidir çünkü WebView yalnızca paketlenmiş yerel dosyaları açar.
        webView.addJavascriptInterface(new Bridge(), "FetihAndroid");
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return blockExternal(request.getUrl());
            }
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                return blockExternal(Uri.parse(url));
            }
        });
        tts = new TextToSpeech(this, status -> {
            if (status == TextToSpeech.SUCCESS && tts != null) {
                int r = tts.setLanguage(new Locale("tr", "TR"));
                ttsReady = r != TextToSpeech.LANG_MISSING_DATA && r != TextToSpeech.LANG_NOT_SUPPORTED;
                if (!ttsReady) ttsReady = tts.setLanguage(Locale.getDefault()) >= 0;
            }
        });
        setContentView(webView);
        hideSystemUi();
        webView.loadUrl(HOME);
    }

    private boolean blockExternal(Uri url) {
        if (url == null) return true;
        String u = url.toString();
        return !(u.startsWith("file:///android_asset/") || u.startsWith("about:blank"));
    }

    @SuppressWarnings("deprecation")
    private void hideSystemUi() {
        getWindow().getDecorView().setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                        | View.SYSTEM_UI_FLAG_FULLSCREEN
                        | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                        | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                        | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                        | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN);
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) hideSystemUi();
    }

    private class Bridge {
        /** Nidalar, "Ricat! Ricat!" ve komut sesleri. */
        @JavascriptInterface
        public void speak(String text, double pitch, double rate) {
            runOnUiThread(() -> {
                if (ttsReady && tts != null) {
                    tts.setPitch((float) Math.max(0.3, Math.min(2.0, pitch)));
                    tts.setSpeechRate((float) Math.max(0.5, Math.min(2.0, rate)));
                    tts.speak(text, TextToSpeech.QUEUE_FLUSH, null, "fetih-ses");
                }
            });
        }
    }

    @Override
    protected void onPause() {
        if (webView != null) webView.evaluateJavascript("window.Game && Game.S && Game.save()", null);
        super.onPause();
    }

    @Override
    public void onBackPressed() {
        if (webView == null) { super.onBackPressed(); return; }
        webView.evaluateJavascript("window.onAndroidBack ? onAndroidBack() : false", value -> {
            if (!"true".equals(value)) MainActivity.super.onBackPressed();
        });
    }

    @Override
    protected void onDestroy() {
        if (tts != null) { tts.stop(); tts.shutdown(); }
        if (webView != null) { webView.destroy(); webView = null; }
        super.onDestroy();
    }
}
