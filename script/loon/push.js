// loon_profile_notify.js
// 兼容 Loon/Surge 的脚本，读取自定义参数并向你的服务器上报

// 在 Loon 中：可在脚本运行前，通过「脚本 -> 脚本设置」或其它方式
//   $persistentStore.write("notify_server_url", "http://<你的服务器>:8000/hook")
//   $persistentStore.write("notify_secret", "my-secret")      // 可选
//   $persistentStore.write("notify_note", "修改了节点/规则")   // 可选

const read = (k, d = "") => {
    try { return $persistentStore.read(k) ?? d; } catch { return d; }
};

const url = read("notify_server_url", "");
if (!url) {
    $notification.post("Loon 配置上报失败", "未设置 notify_server_url", "请写入持久化键后再试");
    $done();
}

const payload = {
    app: "Loon",
    action: "profile_changed_or_report",
    timestamp: new Date().toISOString(),
    // 你可以把对你来说有意义的“配置状态”塞进去（比如自定义的开关、备注等）
    note: read("notify_note", ""),
    // 也把环境信息发过去，便于在服务端看到运行环境
    environment: (typeof $environment !== "undefined") ? $environment : {},
};

const headers = {
    "Content-Type": "application/json",
    "X-Secret": read("notify_secret", "")
};

$httpClient.post(
    { url, headers, body: JSON.stringify(payload) },
    (error, response, data) => {
        if (error) {
            $notification.post("Loon 配置上报失败", url, String(error));
            $done();
            return;
        }
        const code = response?.status || response?.statusCode;
        $notification.post("Loon 配置上报成功", url, `HTTP ${code}`);
        $done();
    }
);
