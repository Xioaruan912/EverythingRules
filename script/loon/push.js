// loon_profile_notify_fixed.js
// 固定上报 URL，无需写入持久化参数

const url = "http://8.211.128.181:8000/hook";   // <- 这里改成你的服务器地址
const secret = "my-secret";                     // 可选
const note = "修改了节点/规则";                  // 可选

const say = (title, sub, body) => { try { $notification.post(title, sub, body); } catch (e) { } };
const log = (...args) => { try { console.log(...args); } catch (e) { } };

say("开始上报", url, "环境检测中…");

const payload = {
    app: "Loon",
    action: "profile_changed_or_report",
    timestamp: new Date().toISOString(),
    note,
    environment: (typeof $environment !== "undefined") ? $environment : {}
};

const headers = { "Content-Type": "application/json" };
if (secret) headers["X-Secret"] = secret;

$httpClient.post(
    { url, headers, body: JSON.stringify(payload) },
    (error, response, data) => {
        if (error) {
            say("配置上报失败", url, String(error));
            log("[ERROR]", error);
            $done();
            return;
        }
        const code = response?.status || response?.statusCode;
        const preview = (data || "").slice(0, 300);
        say("配置上报完成", `HTTP ${code}`, preview || "无响应体");
        log("[RESP]", code, preview);
        $done();
    }
);
