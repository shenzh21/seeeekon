package app.liubai.chat;

import android.content.Context;
import android.content.SharedPreferences;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;
import java.net.URL;
import javax.net.ssl.HttpsURLConnection;
import java.io.InputStream;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executors;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.atomic.AtomicBoolean;

/** Device-local credential, encrypted with a non-exportable Android Keystore key. */
@CapacitorPlugin(name = "KeyVault")
public class KeyVaultPlugin extends Plugin {
    private static final String ALIAS = "liubai.deepseek.v1";
    private final ExecutorService network = Executors.newFixedThreadPool(4);
    private final ExecutorService aborts = Executors.newCachedThreadPool();
    private final ConcurrentHashMap<String, HttpsURLConnection> requests = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, AtomicBoolean> cancellations = new ConcurrentHashMap<>();
    private SharedPreferences prefs() {
        return getContext().getSharedPreferences("deepseek_credentials", Context.MODE_PRIVATE);
    }
    private SecretKey key() throws Exception {
        KeyStore store = KeyStore.getInstance("AndroidKeyStore");
        store.load(null);
        if (!store.containsAlias(ALIAS)) {
            KeyGenerator generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
            generator.init(new KeyGenParameterSpec.Builder(ALIAS, KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).build());
            generator.generateKey();
        }
        return (SecretKey) store.getKey(ALIAS, null);
    }
    @PluginMethod public void set(PluginCall call) {
        String value = call.getString("value", "");
        if (!value.matches("sk-[A-Za-z0-9_-]{16,200}")) { call.reject("Invalid credential"); return; }
        try {
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.ENCRYPT_MODE, key());
            String encrypted = Base64.encodeToString(cipher.doFinal(value.getBytes(StandardCharsets.UTF_8)), Base64.NO_WRAP);
            if (!prefs().edit().putString("cipher", encrypted).putString("iv", Base64.encodeToString(cipher.getIV(), Base64.NO_WRAP)).commit())
                throw new Exception();
            call.resolve();
        } catch (Exception ignored) { call.reject("无法安全保存连接，请重试。"); }
    }
    private String credential() throws Exception {
        String encrypted = prefs().getString("cipher", null);
        if (encrypted == null) throw new Exception("Missing credential");
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.DECRYPT_MODE, key(), new GCMParameterSpec(128, Base64.decode(prefs().getString("iv", ""), Base64.NO_WRAP)));
        return new String(cipher.doFinal(Base64.decode(encrypted, Base64.NO_WRAP)), StandardCharsets.UTF_8);
    }
    @PluginMethod public void get(PluginCall call) {
        try {
            JSObject result = new JSObject();
            result.put("connected", prefs().contains("cipher") && !credential().isEmpty());
            call.resolve(result);
        } catch (Exception ignored) { call.reject("本机连接已失效，请重新连接。"); }
    }
    @PluginMethod public void remove(PluginCall call) {
        if (prefs().edit().clear().commit()) call.resolve(); else call.reject("无法清除连接");
    }
    private void event(String id, String type, JSObject data) {
        data.put("id", id); data.put("type", type);
        notifyListeners("http", data);
    }
    @PluginMethod public void cancel(PluginCall call) {
        String id = call.getString("id", "");
        AtomicBoolean cancelled = cancellations.get(id);
        if (cancelled != null) cancelled.set(true);
        HttpsURLConnection connection = requests.get(id);
        if (connection != null) aborts.execute(connection::disconnect);
        call.resolve();
    }
    @PluginMethod public void request(PluginCall call) {
        String id = call.getString("id", "");
        String address = call.getString("url", "");
        String method = call.getString("method", "GET");
        try {
            URL url = new URL(address);
            if (!"https".equals(url.getProtocol()) || !"api.deepseek.com".equals(url.getHost()) || url.getUserInfo() != null || (url.getPort() != -1 && url.getPort() != 443)) throw new Exception();
            if (!id.matches("[a-f0-9-]{36}") || !method.matches("GET|POST|DELETE")) throw new Exception();
        } catch (Exception ignored) { call.reject("请求地址不受支持"); return; }
        AtomicBoolean cancelled = new AtomicBoolean(false);
        if (cancellations.putIfAbsent(id, cancelled) != null) { call.reject("重复请求"); return; }
        JSObject headers = call.getObject("headers", new JSObject());
        String body = call.getString("body");
        call.resolve();
        network.execute(() -> {
            HttpsURLConnection connection = null;
            try {
                if (cancelled.get()) return;
                connection = (HttpsURLConnection) new URL(address).openConnection();
                requests.put(id, connection);
                connection.setInstanceFollowRedirects(false);
                connection.setConnectTimeout(30000);
                connection.setReadTimeout(180000);
                connection.setRequestMethod(method);
                for (String header : new String[]{"content-type", "accept", "anthropic-beta", "anthropic-version"}) {
                    String value = headers.optString(header, "");
                    if (!value.isEmpty()) connection.setRequestProperty(header, value);
                }
                connection.setRequestProperty("Authorization", "Bearer " + credential());
                if (body != null) {
                    byte[] bytes = Base64.decode(body, Base64.NO_WRAP);
                    connection.setDoOutput(true);
                    connection.setFixedLengthStreamingMode(bytes.length);
                    try (var output = connection.getOutputStream()) { output.write(bytes); }
                }
                if (cancelled.get()) return;
                int status = connection.getResponseCode();
                JSObject start = new JSObject(); start.put("status", status);
                start.put("contentType", connection.getContentType()); event(id, "headers", start);
                InputStream input = status >= 400 ? connection.getErrorStream() : connection.getInputStream();
                if (input != null) try (input) {
                    byte[] buffer = new byte[8192]; int count;
                    while (!cancelled.get() && (count = input.read(buffer)) != -1) {
                        JSObject data = new JSObject();
                        data.put("data", Base64.encodeToString(buffer, 0, count, Base64.NO_WRAP));
                        event(id, "chunk", data);
                    }
                }
                if (!cancelled.get()) event(id, "end", new JSObject());
            } catch (Exception ignored) {
                if (!cancelled.get()) event(id, "error", new JSObject());
            } finally {
                if (connection != null) connection.disconnect();
                requests.remove(id); cancellations.remove(id);
            }
        });
    }
    @Override protected void handleOnDestroy() {
        for (AtomicBoolean flag : cancellations.values()) flag.set(true);
        for (HttpsURLConnection connection : requests.values()) connection.disconnect();
        network.shutdownNow();
        aborts.shutdownNow();
    }
}
