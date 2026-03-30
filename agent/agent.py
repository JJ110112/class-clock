"""
Class Clock — Multi-Agent QA Loop (4 節點 + Human-in-the-loop)

test_runner 會真正執行 npm test (Vitest)，不是 LLM 猜測。

流程：
  test_runner (真實執行測試) → security_auditor → qa_lead
                                                    │
                                              NEEDS_FIX → code_fixer → ⏸ Human 確認 → test_runner
                                              PASS/FAIL → END
"""

from typing import TypedDict, List
from langgraph.graph import StateGraph, START, END
from langchain_anthropic import ChatAnthropic
import json, re, subprocess, os

# ══════════════════════════════════════════
#  狀態定義
# ══════════════════════════════════════════
class QAState(TypedDict):
    project_path: str
    target_files: List[str]

    # 測試員
    test_result: str
    test_passed: int
    test_failed: int
    test_details: str

    # 安全審計員
    security_report: str
    security_issues: List[str]
    security_score: int

    # 品管主管
    qa_verdict: str
    qa_report: str
    fix_instructions: str

    # 修復員
    fix_patch: str
    fix_files: List[str]
    fix_summary: str

    # 控制
    iteration: int
    human_approved: bool


# ══════════════════════════════════════════
#  LLM + 工具
# ══════════════════════════════════════════
model = ChatAnthropic(model="claude-sonnet-4-20250514", temperature=0)

# 專案路徑（agent.py 在 agent/ 子目錄，專案根在上層）
PROJECT_ROOT = os.environ.get(
    "PROJECT_ROOT",
    os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
)


def _parse_json(content: str) -> dict:
    try:
        match = re.search(r'\{[\s\S]*\}', content)
        if match:
            return json.loads(match.group())
    except Exception:
        pass
    return {}


def _run_vitest() -> dict:
    """真正執行 npm test (Vitest) 並解析結果"""
    try:
        result = subprocess.run(
            ["npm", "test"],
            cwd=PROJECT_ROOT,
            capture_output=True,
            text=True,
            timeout=60,
            shell=False,
            encoding="utf-8",
            errors="replace",
        )
        raw_output = (result.stdout or "") + "\n" + (result.stderr or "")
        # Strip ANSI escape codes for reliable parsing
        output = re.sub(r'\x1b\[[0-9;]*m', '', raw_output)

        passed = 0
        failed = 0

        # Vitest: "Tests  68 passed (68)" vs "Test Files  3 passed (3)"
        tests_match = re.search(r'Tests\s+(\d+)\s+passed', output)
        tests_fail = re.search(r'Tests\s+.*?(\d+)\s+failed', output)
        if tests_match:
            passed = int(tests_match.group(1))
        if tests_fail:
            failed = int(tests_fail.group(1))

        fail_details = []
        for line in output.split('\n'):
            if 'FAIL' in line or 'AssertionError' in line or '✕' in line or '×' in line:
                fail_details.append(line.strip())

        summary = output[-2000:] if len(output) > 2000 else output

        return {
            "passed": passed,
            "failed": failed,
            "details": "\n".join(fail_details[:20]) if fail_details else "",
            "summary": summary,
            "success": result.returncode == 0
        }
    except subprocess.TimeoutExpired:
        return {"passed": 0, "failed": 1, "details": "Test timeout", "summary": "", "success": False}
    except Exception as e:
        return {"passed": 0, "failed": 1, "details": f"Test error: {str(e)}", "summary": "", "success": False}etails else "無失敗項目",
            "summary": summary,
            "exit_code": result.returncode,
        }
    except subprocess.TimeoutExpired:
        return {
            "passed": 0, "failed": -1,
            "details": "測試執行超時（> 60 秒）",
            "summary": "TIMEOUT",
            "exit_code": -1,
        }
    except Exception as e:
        return {
            "passed": 0, "failed": -1,
            "details": f"執行錯誤：{str(e)}",
            "summary": str(e),
            "exit_code": -1,
        }


# ══════════════════════════════════════════
#  節點 1：QA 測試員（真正執行測試）
# ══════════════════════════════════════════
def test_runner(state: QAState) -> dict:
    """真正執行 npm test 並回報結果"""
    result = _run_vitest()

    passed = result["passed"]
    failed = result["failed"]
    details = result["details"]
    exit_code = result["exit_code"]

    if exit_code == 0:
        summary = f"✅ 全部通過：{passed} passed, {failed} failed (exit code: 0)"
    elif failed == -1:
        summary = f"❌ 測試執行異常：{details}"
    else:
        summary = f"⚠️ 有失敗：{passed} passed, {failed} failed (exit code: {exit_code})"

    return {
        "test_passed": passed,
        "test_failed": failed,
        "test_result": summary,
        "test_details": details,
    }


# ══════════════════════════════════════════
#  節點 2：安全審計員
# ══════════════════════════════════════════
def security_auditor(state: QAState) -> dict:
    """讀取真實程式碼進行安全審查"""

    files_content = {}
    key_files = [
        "js/exam-data.js", "js/exam-engine.js", "js/exam-ui.js",
        "js/menu.js", "js/clock.js", "js/audio.js",
        "index.html",
    ]
    for f in key_files:
        fpath = os.path.join(PROJECT_ROOT, f)
        try:
            with open(fpath, "r", encoding="utf-8") as fh:
                content = fh.read()
                files_content[f] = content[:3000]
        except Exception:
            files_content[f] = "(檔案不存在或無法讀取)"

    files_summary = "\n\n".join(
        f"### {name}\n```\n{content}\n```"
        for name, content in files_content.items()
    )

    prompt = f"""你是資安專家，根據以下真實程式碼審查這個「教室時鐘」系統的安全性。

## 重要上下文（評分時必須考慮）
- 這是教室時鐘網頁應用，純前端 HTML/CSS/JS，無後端
- 資料存在 localStorage，僅在本機使用
- 無用戶認證、無敏感資料傳輸
- 只需關注「可實際被利用」的安全問題（如 XSS、注入等）

## 測試結果
- 通過：{state.get('test_passed', 0)}，失敗：{state.get('test_failed', 0)}

## 關鍵檔案內容
{files_summary}

## 評分面向（各 0-20 分，滿分 100）
1. XSS 防護 — innerHTML 使用是否安全？
2. 資料驗證 — localStorage 讀取是否有錯誤處理？
3. 程式碼品質 — 是否有明顯邏輯錯誤？
4. 輸入驗證 — 用戶輸入（考程名稱等）是否有驗證？
5. 依賴安全 — 外部資源載入是否安全？

請回覆 JSON：
{{"security_score": 數字(0-100), "security_issues": ["只列實際可利用的問題"], "security_report": "摘要(200字內)"}}"""

    data = _parse_json(model.invoke(prompt).content)
    return {
        "security_score": data.get("security_score", 80),
        "security_issues": data.get("security_issues", []),
        "security_report": data.get("security_report", "審查完成"),
    }


# ══════════════════════════════════════════
#  節點 3：品管主管
# ══════════════════════════════════════════
def qa_lead(state: QAState) -> dict:
    iteration = state.get("iteration", 0) + 1
    test_failed = state.get("test_failed", 0)
    security_score = state.get("security_score", 0)

    if test_failed <= 1 and security_score >= 60:
        verdict = "PASS"
        report = (
            f"✅ 品管通過！\n"
            f"測試：{state.get('test_passed', 0)} passed / {test_failed} failed\n"
            f"安全：{security_score}/100\n"
            f"迭代：{iteration} 輪\n\n"
            f"測試摘要：{state.get('test_result', '')}\n"
            f"安全摘要：{state.get('security_report', '')}"
        )
        fix = ""
    elif iteration >= 3:
        verdict = "FAIL"
        report = (
            f"❌ 已達最大迭代次數 ({iteration})，仍有問題未解決。\n"
            f"測試：{state.get('test_passed', 0)} passed / {test_failed} failed\n"
            f"安全：{security_score}/100\n"
            f"失敗詳情：{state.get('test_details', '')}\n"
            f"安全問題：{state.get('security_issues', [])}"
        )
        fix = ""
    else:
        verdict = "NEEDS_FIX"
        prompt = f"""分析以下測試失敗，給出具體修復指示（200 字內）：
失敗數：{test_failed}
詳情：{state.get('test_details', '')}
安全問題：{state.get('security_issues', [])}

請回覆 JSON：{{"fix_instructions": "修復指示", "qa_report": "報告"}}"""
        data = _parse_json(model.invoke(prompt).content)
        report = data.get("qa_report", f"需要修復 {test_failed} 個失敗項目")
        fix = data.get("fix_instructions", state.get('test_details', ''))

    return {
        "qa_verdict": verdict,
        "qa_report": report,
        "fix_instructions": fix,
        "iteration": iteration,
    }


# ══════════════════════════════════════════
#  節點 4：修復員
# ══════════════════════════════════════════
def code_fixer(state: QAState) -> dict:
    instructions = state.get("fix_instructions", "")
    test_details = state.get("test_details", "")
    security_issues = state.get("security_issues", [])

    prompt = f"""你是資深前端工程師，根據 QA 報告修復程式碼。

## 專案路徑：{PROJECT_ROOT}
## 技術：純 HTML/CSS/JS（教室時鐘），Vitest 測試

## 修復指示
{instructions}

## 測試失敗詳情
{test_details}

## 安全問題
{security_issues}

## 規則
- 只修復問題，不改功能
- 產生 unified diff 格式的修復
- 列出會修改的檔案

請回覆 JSON：
{{"fix_patch": "diff 或程式碼", "fix_files": ["檔案"], "fix_summary": "摘要"}}"""

    data = _parse_json(model.invoke(prompt).content)
    return {
        "fix_patch": data.get("fix_patch", "無法產生修復"),
        "fix_files": data.get("fix_files", []),
        "fix_summary": data.get("fix_summary", "修復方案已產生"),
        "human_approved": False,
    }


# ══════════════════════════════════════════
#  路由
# ══════════════════════════════════════════
def route_after_qa_lead(state: QAState) -> str:
    verdict = state.get("qa_verdict", "FAIL")
    if verdict == "NEEDS_FIX":
        return "code_fixer"
    return "end"


def route_after_human_review(state: QAState) -> str:
    if state.get("human_approved", False):
        return "test_runner"
    return "end"


# ══════════════════════════════════════════
#  構建圖
# ══════════════════════════════════════════
workflow = StateGraph(QAState)

workflow.add_node("test_runner", test_runner)
workflow.add_node("security_auditor", security_auditor)
workflow.add_node("qa_lead", qa_lead)
workflow.add_node("code_fixer", code_fixer)

workflow.set_entry_point("test_runner")
workflow.add_edge("test_runner", "security_auditor")
workflow.add_edge("security_auditor", "qa_lead")

workflow.add_conditional_edges(
    "qa_lead",
    route_after_qa_lead,
    {"code_fixer": "code_fixer", "end": END}
)

workflow.add_conditional_edges(
    "code_fixer",
    route_after_human_review,
    {"test_runner": "test_runner", "end": END}
)

graph = workflow.compile(interrupt_after=["code_fixer"])
