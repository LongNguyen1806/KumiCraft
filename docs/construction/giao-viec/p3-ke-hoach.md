# Kế hoạch Phase 3 — AI chat

Viết 2026-10-21, sau phần tự động của cổng G2 (trace Phase 2 đạt 301/301, `pnpm verify` 991 test, E2E 28/28). Kiểm tay G2 làm song song; lỗi tìm được thì sửa trước lượt kế tiếp đang làm.

## 1. Mục tiêu và cổng G3

Người dùng mở ô chat, gõ yêu cầu, agent trên máy (`agy` hoặc `claude`) đọc bản sao backend, sửa code của dự án; Canvas cập nhật; người dùng xem danh sách file đổi, diff, và **hoàn tác cả lượt**. Bí mật của backend không bao giờ tới agent.

**Cổng G3:** `pnpm verify` xanh với trace Phase 3 (`currentPhase: 3`); E2E AC-08, AC-09 với agent giả lập; bộ E2E hồi quy vẫn xanh; kiểm tay với **agent thật** trên Windows (macOS khi có máy) theo mục 5.

## 2. Hiện trạng (rà 2026-10-21)

| Phần                   | Đã có                                                                                               | Còn thiếu                                                                                        |
| ---------------------- | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Tiến trình con         | `ProcessPort.spawn` mảng tham số, `cross-spawn`, `kill()` dừng cả cây (`taskkill /T`), lọc env S-53 | Thời hạn 30 phút cho agent                                                                       |
| Job                    | `JobService` có `cancel`, `cancelKind`; `JOB_KINDS` đã có `agent.turn`                              | Job `agent.turn`, `agent.install`, `agent.login`                                                 |
| Bí mật                 | `redactSecrets` (S-32, S-33) dùng cho runner log                                                    | Bộ nhận diện **file** bí mật S-30, chặn mở S-31                                                  |
| Backend                | R-PJ-14: thêm, gỡ, trạng thái `ok`/`missing`/`blocked`, dấu vân tay tin cậy                         | Bản sao (M-MR), nút Thêm backend trong chat (R-CH-07)                                            |
| Cài đặt                | `settings.agent.preferred` (`auto`/`agy`/`claude`), mã lỗi E026, E027 đã khai báo                   | Dò agent, trạng thái đăng nhập, Cài đặt/Đăng nhập (R-AG-21)                                      |
| Lịch sử                | Watcher R-HI-05 coi file ghi từ ngoài là thay đổi bên ngoài                                         | Test R-AG-18 với file agent ghi                                                                  |
| Thư viện               | `ignore@7.0.12` có sẵn trong lockfile (qua eslint)                                                  | `diff` (jsdiff, ADR-BE-17), hiển thị Markdown an toàn                                            |
| MCP (R-AG-19, R-AG-20) | —                                                                                                   | Toàn bộ; phụ thuộc VG-17 (agent nhận cấu hình MCP qua tham số được không)                        |
| Trace Phase 3          | —                                                                                                   | 48 mã chưa có test: R-MR, R-AG, R-CH, R-QA-10 đến 13, S-110 đến 125, S-15, 16, 30, 31, AC-08, 09 |

## 3. Thứ tự các lượt

Mỗi lượt khép một phần trọn vẹn (không stub), ≤ 600 dòng code, ≤ 15 tình huống test. Hợp đồng dùng chung của cả phase (kiểu trong `shared/src/agent.ts`) chốt ở lượt 1 để các lượt sau không đổi lại.

| Lượt | WP       | Nội dung                                                                                                                                                                                                  | Mã                                                              | Phụ thuộc | Ai                         |
| ---- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- | --------- | -------------------------- |
| 0    | WP-3.01  | **Spike VG-17**: chạy `agy`, `claude` thật trên máy chủ dự án; ghi tham số chạy không tương tác, mẫu đầu ra luồng JSON, tiếp tục hội thoại, hủy, dò "chưa đăng nhập", lệnh cài và đăng nhập, cách nạp MCP | VG-17                                                           | —         | Chủ dự án chạy, Claude ghi |
| 1    | WP-3.02  | **Hợp đồng Phase 3 + bản sao backend:** kiểu `agent.ts`; nhận diện file bí mật; `MirrorService` (chép, loại trừ, che bí mật, manifest, làm mới gia tăng, kiểm sau lượt, xóa khi gỡ backend)               | R-MR-01 đến 04, S-30, S-31, S-120 đến 125, AC-11 (phần bản sao) | —         | Gemini                     |
| 2    | WP-3.03a | **Agent giả lập + adapter:** `fake-agent.mjs` (kịch bản JSON), adapter `agy`/`claude` (`buildArgs`, `parseLine` theo mẫu VG-17), dò agent 5 s, `GET /agents`                                              | R-QA-10 đến 13, R-AG-10, S-112, S-115                           | 0, 1      | Gemini                     |
| 3    | WP-3.04a | **Ảnh chụp lượt + hoàn tác:** chụp dự án (≤ 200 MB, giữ 20 lượt), so hash lập danh sách file, diff unified, hoàn tác cả lượt (E017 khi file bị sửa thêm)                                                  | R-AG-15, S-113, NFR-09                                          | 1         | Gemini                     |
| 4    | WP-3.03b | **Chạy lượt AI:** điều kiện (E011, E026, E018), lời nhắc `prompt.ts`, spawn, `agent.event`, hủy, quá 30 phút, lỗi E027, hội thoại `continue`, lưu `TurnSummary`; REST `/agent/turns`                      | R-AG-11 đến 14, 16 đến 18, S-110, 111, 116 đến 118              | 2, 3      | Gemini                     |
| 5    | WP-3.05a | **Ô chat, phần 1:** tab Chat cạnh Inspector, ô nhập `Mod+Enter`, thẻ ngữ cảnh, đính kèm tài liệu, luồng sự kiện (Markdown an toàn), Hủy, trạng thái khóa, nút Thêm backend                                | R-CH-01, 02, 03, 06, 07, S-14, S-15                             | 4         | Gemini                     |
| 6    | WP-3.05b | **Ô chat, phần 2:** danh sách file đổi (ảo hóa), xem diff, Hoàn tác lượt này, Mở trong editor, lịch sử hội thoại, Hội thoại mới; Cài đặt: trạng thái agent, nút Cài đặt và Đăng nhập                      | R-CH-04, 05, R-AG-21, S-16                                      | 5         | Gemini                     |
| 7    | —        | **Công cụ của app qua MCP:** máy chủ MCP cục bộ của phiên (cùng token, giới hạn), các thao tác thiết kế thành công cụ, mỗi lần gọi một mục lịch sử; `report_tool_gap` và danh sách "Công cụ còn thiếu"    | R-AG-19, R-AG-20                                                | 4, VG-17  | Gemini + Claude            |
| 8    | G3       | **Cổng G3:** E2E AC-08, AC-09 với agent giả lập, trace Phase 3, E2E hồi quy, kiểm tay với agent thật                                                                                                      | AC-08, AC-09                                                    | tất cả    | Claude + chủ dự án         |

Lượt 1 và 3 không cần VG-17 nên làm trước trong lúc chờ spike. Nếu VG-17 cho thấy agent không nhận cấu hình MCP qua tham số (mà phải sửa cấu hình của agent, trái S-112), lượt 7 dừng lại để chủ dự án quyết.

## 4. Quy ước chung của Phase 3

| Việc            | Cách làm                                                                                                                                                                             |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Test            | Gemini viết unit, component, integration. Test agent luôn dùng **agent giả lập** (quyết định 2026-10-20). Claude thêm `*-brief.test.ts` khóa các tình huống của bản giao việc khi QA |
| E2E             | Chỉ ở cổng G3: AC-08, AC-09 (SPEC-04 M-AG #7, #8, M-CH) do Claude viết; bộ hồi quy chạy ở lượt đụng runner, phiên, Bridge                                                            |
| Bí mật          | Mọi chuỗi đi tới agent, chat, log qua `redactSecrets`; test dùng chuỗi `RC_SECRET_MARKER_*` và khẳng định không lọt                                                                  |
| Thư mục dữ liệu | Bản sao ở `envPaths('kumicraft').cache/mirrors/…`; ảnh chụp và lượt ở `envPaths('kumicraft').data/turns/<projectId>/…`; quyền `0700` trên macOS/Linux                                |
| Trace           | `currentPhase` giữ 2 trong lúc làm; mỗi lượt gắn mã `[R-xx]`, `[S-xx]` vào test; chuyển sang 3 ở cổng G3                                                                             |
| Kiểm tay        | Mỗi bản giao việc có mục Kiểm tay; dự án mới + WorkTracker (backend Django). Lượt 4 trở đi có thêm bước với agent thật khi chủ dự án muốn                                            |

## 5. Kịch bản kiểm tay cổng G3 (agent thật)

1. Dự án mới, gắn backend Express mẫu có `.env` chứa `RC_SECRET_MARKER_1`; mở thư mục bản sao: không có `.env`, không có chuỗi đánh dấu.
2. Chat: "Tạo trang quản lý sản phẩm theo API của backend" → agent viết lớp gọi API và trang; Canvas hiện trang; thư mục backend thật không đổi byte nào (AC-08).
3. Xem diff từng file; "Hoàn tác lượt này" → dự án về như trước lượt (`git diff` rỗng).
4. Chọn một Card, chat "thêm nút Mua" → ngữ cảnh có `file:dòng` của Card, nút xuất hiện đúng chỗ (AC-09).
5. Gửi yêu cầu dài rồi bấm Hủy → không còn tiến trình agent; file đã đổi vẫn liệt kê và hoàn tác được.
6. Tắt mạng hoặc đăng xuất agent → chat báo lỗi rõ (E026/E027); Canvas, Inspector vẫn dùng được.
7. Máy chưa có agent: Cài đặt hiện "chưa cài", nút Cài đặt chạy lệnh chính thức; sau đó Đăng nhập; chat mở khóa.
8. Lặp bước 2–3 trên WorkTracker (backend Django) ở giao diện `en`.
9. **Lệnh không bao giờ kết thúc** (chủ dự án thử 2026-10-23 với "chạy lệnh remote control"): gửi yêu cầu khiến agent chạy một lệnh chạy nền mãi (`agy remote-control`, `npm run dev`…). Kỳ vọng: lượt hiện "đang chạy" kèm nút Hủy; bấm Hủy → lượt dừng, **không còn tiến trình nào** của lượt (kiểm Task Manager, kể cả tiến trình con agent tự bật); không bấm thì tới 30 phút báo hết giờ.
10. **Server khởi động lại giữa lượt** (lỗi tìm được 2026-10-23 khi thử bước 9): đang có lượt chạy thì tắt và bật lại `npm run dev`. Kỳ vọng: ô chat không bị khóa mãi; lượt đó hiện "Lỗi" sau khi Studio nối lại, gửi tiếp được.

## 6. Rủi ro đã biết

| Rủi ro                                                             | Cách giữ                                                                               |
| ------------------------------------------------------------------ | -------------------------------------------------------------------------------------- |
| Tham số và đầu ra của `agy` chưa biết chắc (spec chỉ ghi ứng viên) | Lượt 0 (VG-17) trước lượt 2; adapter chỉ dựa vào mẫu đầu ra ghi thật trong `fixtures/` |
| Agent sửa file trong bản sao hoặc chạm backend thật                | Không bao giờ truyền đường dẫn thật (S-111); kiểm hash bản sao sau lượt (S-118)        |
| Hoàn tác lượt đè mất sửa tay của người dùng sau lượt               | So hash từng file trước khi hoàn tác; khác thì E017, không đổi file nào (R-AG-15)      |
| Dự án lớn làm ảnh chụp chậm                                        | Giới hạn 200 MB, bỏ `node_modules`, `.git`, thư mục build; vượt thì không chạy lượt    |
| Gemini thay số trong test khóa                                     | Claude thêm `*-brief.test.ts` ở mỗi lần QA                                             |
