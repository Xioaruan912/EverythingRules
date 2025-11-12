// loon_profile_notify_fixed_with_raw_config.js
// 固定上报 URL，并上传当前配置原始文本

const url = "http://103.117.120.98:8000/hook";   // ← 改成你的服务器地址
const secret = "my-secret";                     // 可选
const note = "修改了节点/规则（附带原始配置）";   // 可选

const say = (title, sub, body) => { try { $notification.post(title, sub, body); } catch (e) {} };
const log = (...args) => { try { console.log(...args); } catch (e) {} };

say("开始上报", url, "读取环境 & 配置中…");

// 获取 Loon 当前配置原始文本
let rawConfigText = null;
try {
  if (typeof $config !== "undefined" && typeof $config.getConfig === "function") {
    rawConfigText = $config.getConfig(); // 原始字符串（JSON 文本）
  }
} catch (e) {
  log("[WARN] 无法读取配置:", e);
}

const payload = {
  app: "Loon",
  action: "profile_changed_or_report",
  timestamp: new Date().toISOString(),
  note,
  environment: (typeof $environment !== "undefined") ? $environment : {},
  config_text: rawConfigText || "(未能读取配置内容)",
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
