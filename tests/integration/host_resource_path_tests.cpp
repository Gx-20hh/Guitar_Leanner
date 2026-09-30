#include "webview_host.h"
#include <juce_core/juce_core.h>
#include <iostream>

// T7-host 严格资源路径解析单测（纯逻辑，不启动 WebView/音频）。
// 覆盖：正常入口/子资源；network-path //、..、绝对、反斜杠、冒号、?/#、missing、sibling。
// 临时资源目录保留（不递归删除），用于证据与后续真实浏览器测试参考。

namespace host_path_test {

struct TestResult
{
    int passed = 0;
    int failed = 0;
    juce::String failures;
};

static void check (TestResult& r, const juce::String& name, bool ok)
{
    if (ok) { ++r.passed; }
    else { ++r.failed; r.failures += name + "\n"; }
}

static juce::File makeFixtureRoot()
{
    // 固定临时目录名（保留，不递归删除）。
    const auto root = juce::File::getSpecialLocation (juce::File::tempDirectory)
                          .getChildFile ("guitar-learner-host-test-" + juce::Uuid().toString());
    (void) root.createDirectory();

    // 正常资源
    root.getChildFile ("index.html").replaceWithText ("<!doctype html><title>t</title>");
    root.getChildFile ("assets").createDirectory();
    root.getChildFile ("assets/x.js").replaceWithText ("console.log(1)");

    // sibling 逃逸探测：根外文件（存在但不属于根）
    const auto outside = root.getSiblingFile ("_outside_probe.txt");
    outside.replaceWithText ("secret");

    return root;
}

int runAll()
{
    TestResult r;
    const juce::File root = makeFixtureRoot();

    using R = guitar_learner::ResourceResolution;

    {
        auto res = guitar_learner::WebViewHost::resolveResourcePath (root, "/");
        check (r, "root slash maps to index.html", res.ok && res.file.getFileName() == "index.html");
    }
    {
        auto res = guitar_learner::WebViewHost::resolveResourcePath (root, "/index.html");
        check (r, "/index.html resolves", res.ok && res.file.getFileName() == "index.html");
    }
    {
        auto res = guitar_learner::WebViewHost::resolveResourcePath (root, "/assets/x.js");
        check (r, "/assets/x.js resolves", res.ok && res.file.getFileName() == "x.js");
    }

    // 拒绝：network-path 双斜杠
    {
        auto res = guitar_learner::WebViewHost::resolveResourcePath (root, "//evil.example/path");
        check (r, "reject //network-path", ! res.ok);
        check (r, "reject // has error msg", res.error.isNotEmpty());
    }
    {
        auto res = guitar_learner::WebViewHost::resolveResourcePath (root, "//index.html");
        check (r, "reject //index.html", ! res.ok);
    }

    // 拒绝：路径穿越
    {
        auto res = guitar_learner::WebViewHost::resolveResourcePath (root, "/../outside.txt");
        check (r, "reject /..", ! res.ok);
    }
    {
        auto res = guitar_learner::WebViewHost::resolveResourcePath (root, "/assets/../../outside.txt");
        check (r, "reject nested ..", ! res.ok);
    }

    // 拒绝：绝对/盘符/反斜杠/冒号/query/fragment
    {
        auto res = guitar_learner::WebViewHost::resolveResourcePath (root, "C:/windows/system32/evil.dll");
        check (r, "reject drive-letter absolute (no leading /)", ! res.ok);
    }
    {
        auto res = guitar_learner::WebViewHost::resolveResourcePath (root, "/C:/windows/x");
        check (r, "reject /C: form", ! res.ok);
    }
    {
        auto res = guitar_learner::WebViewHost::resolveResourcePath (root, "/assets\\x.js");
        check (r, "reject backslash", ! res.ok);
    }
    {
        auto res = guitar_learner::WebViewHost::resolveResourcePath (root, "/assets/x.js?debug=1");
        check (r, "reject query string", ! res.ok);
    }
    {
        auto res = guitar_learner::WebViewHost::resolveResourcePath (root, "/assets/x.js#frag");
        check (r, "reject fragment", ! res.ok);
    }
    {
        auto res = guitar_learner::WebViewHost::resolveResourcePath (root, "/assets/x.js#frag");
        check (r, "fragment reject has msg", ! res.ok && res.error.isNotEmpty());
    }

    // 拒绝：缺失 & 空段
    {
        auto res = guitar_learner::WebViewHost::resolveResourcePath (root, "/nope.js");
        check (r, "missing resource rejected", ! res.ok && res.error.contains ("missing"));
    }
    {
        auto res = guitar_learner::WebViewHost::resolveResourcePath (root, "/assets//x.js");
        check (r, "empty segment rejected", ! res.ok);
    }

    // 拒绝：非 / 起始
    {
        auto res = guitar_learner::WebViewHost::resolveResourcePath (root, "assets/x.js");
        check (r, "no leading slash rejected", ! res.ok);
    }

    // 拒绝：root 不存在
    {
        const auto ghost = root.getSiblingFile ("_missing_root");
        auto res = guitar_learner::WebViewHost::resolveResourcePath (ghost, "/");
        check (r, "missing root rejected", ! res.ok);
    }

    // sibling 逃逸：不存在于外的路径不该被解析为根内文件
    {
        auto res = guitar_learner::WebViewHost::resolveResourcePath (root, "/_outside_probe.txt");
        check (r, "root-relative outside file rejected (not in root)", ! res.ok);
    }

    juce::String summary = juce::String::formatted ("passed: %d, failed: %d", r.passed, r.failed);
    std::cout << summary << "\n";
    if (r.failed > 0)
        std::cout << "FAILURES:\n" << r.failures;

    std::cout << "fixture root (kept for evidence): " << root.getFullPathName() << "\n";

    return r.failed == 0 ? 0 : 1;
}

} // namespace host_path_test

int main()
{
    return host_path_test::runAll();
}
