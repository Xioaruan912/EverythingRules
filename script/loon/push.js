// loon_profile_notify_try_raw_profile.js
// 优先上报 .conf 原文；否则退回上报 JSON（$config.getConfig）

const url = "http://103.117.120.98:8000/hook";   // ← 改成你的服务器地址
const secret = "my-secret";                       // 可选
const note = "修改了节点/规则（优先附带原始配置）"; // 可选

const say = (title, sub, body) => { try { $notification.post(title, sub, body); } catch (e) {} };
const log = (...args) => { try { console.log(...args); } catch (e) {} };

say("开始上报", url, "尝试获取原始配置…");

// ---------- 工具函数 ----------
function safeParseJSON(s) {
  try { return JSON.parse(s); } catch (_) { return null; }
}

function collectStrings(obj, out = []) {
  if (obj == null) return out;
  const t = typeof obj;
  if (t === "string") out.push(obj);
  else if (t === "object") {
    if (Array.isArray(obj)) obj.forEach(v => collectStrings(v, out));
    else Object.keys(obj).forEach(k => collectStrings(obj[k], out));
  }
  return out;
}

// 根据字符串集合猜测最可能的 profile/source URL
function guessProfileUrl(strings) {
  const candidates = [];
  const reLikely =
    /(https?:\/\/[^\s"'<>]+?(?:\.conf|\.list|\.txt)(?:\?[^\s"'<>]*)?)/i;
  const reGeneric =
    /(https?:\/\/[^\s"'<>]+)/i;

  strings.forEach(s => {
    // 高优先：明确包含 .conf/.list/.txt 的 URL
    const m1 = s.match(reLikely);
    if (m1) candidates.push({url: m1[1], score: 100});

    // 次优先：包含关键词的任意 URL
    if (!m1) {
      const m2 = s.match(reGeneric);
      if (m2) {
        const u = m2[1];
        let score = 0;
        if (/profile|config|loon|subscribe|rules|rule|surge|quanx/i.test(s)) score += 30;
        if (/\.json$/i.test(u)) score -= 15; // 更像数据源而不是 conf
        if (/\.conf|\.list|\.txt/i.test(u)) score += 40;
        if (score > 0) candidates.push({url: u, score});
      }
    }
  });

  // 去重 + 排序
  const uniq = [];
  const seen = new Set();
  candidates.sort((a,b)=>b.score-a.score).forEach(c=>{
    if (!seen.has(c.url)) { seen.add(c.url); uniq.push(c); }
  });

  return uniq.length ? uniq[0].url : null;
}

// 以“尽量不缓存”的方式抓取
function httpGetNoCache(u, cb) {
  const headers = {
    "User-Agent": "LoonScript/1.0",
    "Cache-Control": "no-cache",
    "Pragma": "no-cache"
  };
  // 给 URL 加一个时间戳，避免缓存
  const sep = u.includes("?") ? "&" : "?";
  const noCacheUrl = `${u}${sep}_ts=${Date.now()}`;

  $httpClient.get({ url: noCacheUrl, headers }, (error, response, data) => {
    if (error) return cb(error);
    const code = response?.status || response?.statusCode;
    if (code >= 200 && code < 300) return cb(null, data, code);
    cb(new Error(`HTTP ${code}`));
  });
}

// ---------- 主流程 ----------
(async () => {
  let rawConfigText = null;
  let cfgText = null;
  let cfgObj = null;
  let profileUrl = null;

  // 1) 读取 Loon 配置 JSON（有些版本返回字符串 JSON）
  try {
    if (typeof $config !== "undefined" && typeof $config.getConfig === "function") {
      const r = $config.getConfig();
      cfgText = (typeof r === "string") ? r : JSON.stringify(r);
      cfgObj = (typeof r === "object") ? r : safeParseJSON(cfgText);
      log("[INFO] 读取到配置 JSON");
    }
  } catch (e) {
    log("[WARN] 无法读取配置 JSON：", e);
  }

  // 2) 从 JSON 中猜测 profile/source URL，尝试抓原文
  if (cfgObj) {
    try {
      const strings = collectStrings(cfgObj, []);
      profileUrl = guessProfileUrl(strings);
      if (profileUrl) {
        log("[INFO] 猜测到配置来源 URL：", profileUrl);
        await new Promise(res => {
          httpGetNoCache(profileUrl, (err, data) => {
            if (!err && data && typeof data === "string" && data.length > 0) {
              rawConfigText = data;
              log("[INFO] 成功抓取原始配置文本，长度：", data.length);
            } else {
              log("[WARN] 抓取原始配置失败：", err);
            }
            res();
          });
        });
      } else {
        log("[INFO] 未发现可能的 profile URL，跳过抓取");
      }
    } catch (e) {
      log("[WARN] 猜测/抓取原文出错：", e);
    }
  }

  // 3) 组织上报载荷
  const payload = {
    app: "Loon",
    action: "profile_changed_or_report",
    timestamp: new Date().toISOString(),
    note,
    environment: (typeof $environment !== "undefined") ? $environment : {},
    // 优先上传原始 .conf（若拿到），否则回退上传 JSON
    config_text_raw: rawConfigText || null,
    config_json: cfgText || "(未能读取到配置 JSON)"
  };

  const headers = { "Content-Type": "application/json" };
  if (secret) headers["X-Secret"] = secret;

  // 4) 上报
  $httpClient.post(
    { url, headers, body: JSON.stringify(payload) },
    (error, response, data) => {
      if (error) {
        say("配置上报失败", url, String(error));
        log("[ERROR]", error);
        return $done();
      }
      const code = response?.status || response?.statusCode;
      const preview = (data || "").slice(0, 300);
      say("配置上报完成", `HTTP ${code}`, preview || "无响应体");
      log("[RESP]", code, preview);
      $done();
    }
  );
})();
