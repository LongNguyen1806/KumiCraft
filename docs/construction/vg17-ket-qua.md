# VG-17 — Kết quả chạy `agy` thật (2026-10-21)

Máy chủ dự án, Windows 11, `agy` 1.4.3. Chưa có `claude`. Script: `scripts/vg/vg-17.mjs`; đầu ra thô ở `artifacts/vg17/` (không commit). Mẫu đã ẩn đường dẫn cá nhân ở `packages/server/src/core/agent/adapters/fixtures/agy-*.jsonl`.

## Đã chốt

| Câu hỏi              | Kết quả                                                                                                                                                                                                                                                |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Dò agent             | `agy --version` → `1.4.3` ở stdout, mã 0. Help in ra **stderr**                                                                                                                                                                                        |
| Chạy không tương tác | `agy -p <yêu cầu> --output-format stream-json [--add-dir <bản sao>]… [--conversation <id>]`, `cwd` = gốc dự án. Mã 0 khi xong                                                                                                                          |
| Đầu ra               | Mỗi dòng một JSON. `{"event":"init","conversation_id",…}`; `{"event":"step_update","step_update":{step_index,state:"ACTIVE"/"DONE",step_type,…}}`; `{"event":"result","result":{conversation_id,status:"SUCCESS",response}}`                           |
| `step_type`          | `user_input`; `agent_response` (chữ đến dần qua `text_delta`); `tool` (`tool_name`, `tool_info.parameters`, ví dụ `read_file` với `Path`, `write_file`, `run_command` với `CommandLine`); `system_message`                                             |
| Tiếp tục hội thoại   | `--conversation <conversation_id>` chạy được, agent nhớ lượt trước                                                                                                                                                                                     |
| Đọc thư mục thêm     | `--add-dir <bản sao>`: agent đọc được `api.js`, thư mục không đổi byte nào                                                                                                                                                                             |
| Hủy                  | `taskkill /T /F` cây tiến trình: dừng hẳn sau 20 s, không còn tiến trình của lượt                                                                                                                                                                      |
| Quyền sửa file       | Do **quy tắc của người dùng trong agy** quyết định (S-112). Máy chủ dự án có `user_rules.md` buộc xác nhận: lượt đầu agent chỉ trình bày kế hoạch và hỏi "Đồng ý". Câu cho phép trong lời nhắc và `--mode accept-edits` **không** vượt qua quy tắc này |
| Xác nhận             | Lượt tiếp theo `--conversation <id>` với nội dung "Đồng ý" → agent gọi `write_file`, file được tạo đúng                                                                                                                                                |
| Lệnh shell           | `permission_mode` báo `always-proceed`; agent tự chạy `run_command` (ví dụ `Get-ChildItem`) để xem thư mục. Có chặn hay không là cấu hình của agy, ReactCraft không đổi                                                                                |
| Cài và đăng nhập     | `agy install` chỉ cấu hình PATH, không phải lệnh cài agy; không có lệnh `login`. Lệnh cài chính thức và cách dò "chưa đăng nhập" **chưa chốt**                                                                                                         |
| MCP                  | Chỉ có `agy mcp add/remove/list/enable/disable` (ghi vào cấu hình của agy), không có cờ nạp MCP cho một lần chạy → R-AG-19 đụng S-112, chờ chủ dự án quyết ở lượt 7                                                                                    |

## Hệ quả cho thiết kế

1. Quyết định của chủ dự án (2026-10-21): **không thiết kế theo quy tắc riêng** trên máy chủ dự án. Thiết kế mặc định: agent sửa file ngay trong lượt (agy không có quy tắc thêm thì làm vậy). Lượt chỉ trả lời mà không đổi file vẫn là lượt hợp lệ; người dùng gõ tiếp trong cùng hội thoại (`continue`), không cần nút riêng. Nếu sau này cần, ReactCraft thêm chỉ dẫn vào mẫu lời nhắc (`prompt.ts`, R-AG-13) trước khi gửi agent; không dùng cờ nới quyền (S-112). Kiểm tay G3 trên máy chủ dự án: trả lời "Đồng ý" hoặc tạm chỉnh `user_rules.md`.
2. `parseLine` của adapter `agy`: `text_delta` gom thành `message`; `step_type: "tool"` + `state: "ACTIVE"` thành `tool` (`target` lấy từ `Path` hoặc `CommandLine`); `init` thành `conversation`; `result.status` khác `SUCCESS` thành `error`. Dòng khác bỏ qua.
3. Không dùng `--dangerously-skip-permissions`, `--mode`, `--sandbox` mặc định (S-112). `--sandbox` có thể là tùy chọn người dùng bật trong Cài đặt (để sau).

## Bổ sung 2026-10-22: lệnh cài và đăng nhập chính thức (R-AG-21)

Nguồn: codelab chính thức của Google "Hands-on with Antigravity CLI" (`codelabs.developers.google.com/antigravity-cli-hands-on`). Máy chủ dự án có `agy` ở `%LOCALAPPDATA%gyingy.exe`, khớp với trình cài này.

| Việc               | Lệnh hoặc cách làm                                                                                                                                                                                                                          |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cài (Windows)      | PowerShell: `irm https://antigravity.google/cli/install.ps1 \| iex`. CMD: `curl -fsSL https://antigravity.google/cli/install.cmd -o install.cmd && install.cmd && del install.cmd`                                                          |
| Cài (macOS, Linux) | `curl -fsSL https://antigravity.google/cli/install.sh \| bash`                                                                                                                                                                              |
| Đăng nhập          | Không có lệnh `login`. Lần đầu chạy `agy` (tương tác) hỏi: Google OAuth (mở trình duyệt, rồi **dán mã** lại vào terminal) hoặc Google Cloud project. Cần terminal thật → nút Đăng nhập mở cửa sổ terminal hệ điều hành chạy `agy` (R-AG-21) |
| Dò đăng nhập       | Không có lệnh chính thức. Giữ `login: 'unknown'` (spec-log #39); lượt AI lỗi vì chưa đăng nhập hiện qua E027 kèm gợi ý bấm Đăng nhập                                                                                                        |
| Sau khi cài        | PATH mới chỉ có ở tiến trình mở **sau** khi cài: server dò lại bằng đường dẫn mặc định `%LOCALAPPDATA%gyingy.exe` (Windows) hoặc nhắc khởi động lại ReactCraft                                                                              |

Lệnh cài chạy script tải từ mạng: Studio hiện đúng lệnh và người dùng bấm xác nhận mỗi lần, như S-54 với cài dependency.
