package app.liubai.chat;

import com.getcapacitor.BridgeActivity;
import android.os.Bundle;
import android.content.Intent;
import android.net.Uri;

public class MainActivity extends BridgeActivity {
    // Capgo reports downloadCompleted after startActivity returns. Keep that
    // lifecycle, but consume our history archives locally instead of a chooser.
    private boolean isHistoryArchiveViewer(Intent intent) {
        if (intent == null || !Intent.ACTION_VIEW.equals(intent.getAction())) return false;
        Uri uri = intent.getData();
        if (uri == null || !"content".equals(uri.getScheme()) ||
            !(getPackageName() + ".fileprovider").equals(uri.getAuthority())) return false;
        java.util.List<String> segments = uri.getPathSegments();
        if (segments.size() != 3 || !"my_cache_images".equals(segments.get(0)) ||
            !"inappbrowser-downloads".equals(segments.get(1))) return false;
        return segments.get(2).matches("(?i)(deepseek_data-[^/\\\\]+|old-version_conversations(?:-\\d+)?)\\.zip");
    }
    @Override public void startActivity(Intent intent) {
        if (!isHistoryArchiveViewer(intent)) super.startActivity(intent);
    }
    @Override public void startActivity(Intent intent, Bundle options) {
        if (!isHistoryArchiveViewer(intent)) super.startActivity(intent, options);
    }
    @Override public void onCreate(Bundle savedInstanceState) {
        registerPlugin(KeyVaultPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
