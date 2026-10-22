# Phase 3 — Lượt 6a: Ô chat, phần 2 — file đổi, diff, hoàn tác, lịch sử (WP-3.05b)

Đọc `README.md` cùng thư mục trước, nhất là mục **"Lỗi lint hay vấp"**, rồi làm đúng bản này. Kế hoạch phase: `p3-ke-hoach.md`. Quy tắc: spec mục 24 (R-CH-04, R-CH-05), ADR-BE-17, ADR-FE-21, SPEC-05 S-16.

Lượt này **chỉ làm Studio**, tiếp nối lượt 5 (`features/chat/`). Server đã có `GET /agent/turns`, `GET /agent/turns/:id/diff`, `POST /agent/turns/:id/revert`, `POST /open-in-editor`; client đã có `fetchTurns`, `fetchTurnDiff`, `revertTurn` (`api/agent-client.ts`), `openInEditor` (`api/editor-client.ts`). Không sửa server, shared, Bridge, `e2e/`, `docs/spec.md`.

Lượt 6b (sau) làm: mục Agent trong Cài đặt, nút Cài đặt / Đăng nhập agy (R-AG-21).

## 1. Mục tiêu (người dùng thấy gì)

1. **Hết lượt** (R-CH-04), dưới tóm tắt "Xong · N file đã đổi" là danh sách file:
   - mỗi dòng có biểu tượng loại thay đổi (sửa `M` vàng, tạo `A` xanh, xóa `D` đỏ) và đường dẫn;
   - bấm dòng → mở **diff** của file đó ngay dưới dòng (bấm lại để đóng);
   - nút **Mở trong editor** cho file sửa / tạo (không có cho file đã xóa).

   Nhiều hơn 50 file thì danh sách cuộn trong khung cao cố định và **ảo hóa** (ADR-FE-21).

2. **Diff** hiện như văn bản (S-16): dòng `+` nền xanh nhạt, dòng `-` nền đỏ nhạt, dòng `@@` xám, phông monospace. Chuỗi "Binary or large file changed" hiện nguyên văn.
3. Nút **Hoàn tác lượt này** (chỉ khi `revertible`): hỏi "Hoàn tác N file của lượt này về như trước?" → Đồng ý → mọi file về như trước lượt.
   - Thành công: dòng "Đã hoàn tác", nút biến mất.
   - Người dùng đã sửa thêm một file sau lượt: hiện câu E017 đã dịch, nêu tên file; không file nào đổi.
4. **Lịch sử** (R-CH-05): mở tab AI → các lượt đã có của dự án (`GET /agent/turns`, tối đa 20) hiện phía trên, cũ trước. Mỗi lượt: yêu cầu của người dùng, tóm tắt, danh sách file, nút Hoàn tác nếu còn được. Lượt cũ **không** có tin nhắn của agent (server không lưu, R-AG-16).
5. Nút **Hội thoại mới** ở đầu ô chat: lượt gửi kế tiếp dùng `conversation: 'new'`; trong luồng hiện một vạch "Hội thoại mới". Lịch sử cũ vẫn giữ.

## 2. Đọc trước (CW-52)

| File                                                                          | Lý do                                                                                       |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `docs/spec.md` mục 24, ADR-BE-17, ADR-FE-21, SPEC-05 S-16                     | Quy tắc gốc                                                                                 |
| `packages/studio/src/features/chat/*` (cả test)                               | Store, luồng sự kiện, thread, tóm tắt lượt, `earlyOutcomes`                                 |
| `packages/studio/src/api/agent-client.ts`, `editor-client.ts`                 | `fetchTurns`, `fetchTurnDiff`, `revertTurn`, `openInEditor(loc)` (loc dạng `file:dòng:cột`) |
| `package.json` của Studio (`@tanstack/react-virtual` có sẵn, chưa dùng ở đâu) | ADR-FE-21: ảo hóa danh sách dài; xem mục 6 bẫy 1, 2                                         |
| `packages/studio/src/routes/error-text.ts`                                    | Dịch E017 (`params.file`)                                                                   |
| `packages/shared/src/agent.ts`                                                | `TurnSummary`, `TurnFile`                                                                   |

## 3. Hợp đồng

### 3.1. Store (`chat-store.ts`)

- `ChatTurnView` thêm `summary?: TurnSummary | undefined` và `history?: boolean` (lượt nạp từ server). Bỏ `fileCount`; số file lấy từ `summary.files.length`.
- `job.completed`: lưu cả `summary` (đã parse bằng `TurnSummarySchema`), không chỉ số file. Giữ cơ chế `earlyOutcomes`.
- `loadHistory(summaries: readonly TurnSummary[])`: thay các lượt `history` bằng danh sách mới. Lượt của phiên hiện tại có cùng `turnId` thì **không** nhân đôi. Sắp xếp cũ trước.
  - Mỗi lượt lịch sử: `{ jobId: '', turnId: s.id, state: s.state, items: [{ kind: 'user', text: s.prompt }], summary: s, history: true }`.
  - `state: 'running'` từ server: hiện như đang chạy nhưng **không** có nút Hủy (không biết `jobId`).
- `markReverted(turnId, summary)`: thay `summary` của lượt đó.
- `newConversation()`: `hasConversation = false`, thêm một mốc `{ kind: 'divider' }` vào **lượt cuối** (`ChatItem` thêm `kind: 'divider'`) hoặc một dòng mốc riêng, tùy cách hiển thị gọn hơn; test chỉ kiểm có `chat-divider` sau lượt cuối.

### 3.2. Nạp lịch sử

`use-chat-history.ts`: khi `ChatPanel` mount **và** ô chat không khóa → `fetchTurns()` → `loadHistory`. Lỗi thì bỏ qua (chat vẫn dùng được). Sau `job.completed` / `job.failed` / `job.cancelled` của lượt hiện tại thì nạp lại một lần (để lấy `summary` của lượt lỗi, lượt hủy).

### 3.3. Giao diện

| File                    | `data-testid`                                                                                                                                   | Nội dung                                                                                                                               |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `chat-files.tsx` (mới)  | `chat-files`, mỗi dòng `chat-file-<index>` (có `data-change`), nút mở editor `chat-file-open-<index>`                                           | Danh sách file; > 50 file dùng `useVirtualizer` trong khung `max-h-64 overflow-auto`                                                   |
| `chat-diff.tsx` (mới)   | `chat-diff` (khung), mỗi dòng `chat-diff-line` có `data-kind="add" \| "del" \| "hunk" \| "ctx"`                                                 | Gọi `fetchTurnDiff(turnId, path)` khi mở; đang tải "Đang tải diff…"; lỗi hiện câu đã dịch. Chỉ render chữ (S-16), mỗi dòng một phần tử |
| `chat-revert.tsx` (mới) | `chat-revert`, hộp xác nhận `chat-revert-dialog`, `chat-revert-confirm`, `chat-revert-cancel`, kết quả `chat-reverted`, lỗi `chat-revert-error` | Chỉ hiện khi `summary.revertible`; gọi `revertTurn(turnId)` → `markReverted`                                                           |
| `chat-thread.tsx`       | `chat-divider`                                                                                                                                  | Gắn `ChatFiles`, `ChatRevert` dưới tóm tắt lượt có `summary`; lượt lịch sử có nhãn nhỏ thời gian `startedAt` (theo ngôn ngữ giao diện) |
| `chat-panel.tsx`        | `chat-new-conversation`                                                                                                                         | Nút Hội thoại mới ở đầu panel, vô hiệu khi đang có lượt chạy                                                                           |

**Mở trong editor:** `openInEditor(\`${path}:1:1\`)`. Lỗi (ví dụ chưa cấu hình editor, E021) hiện tạm dưới dòng file bằng câu đã dịch.

i18n: thêm khóa vào namespace `chat` (vi, en).

### 3.4. Spec-log (số tiếp theo sau #47)

- `#48` R-CH-05: lượt lịch sử chỉ có yêu cầu, tóm tắt, danh sách file; không có tin nhắn agent (R-AG-16 không lưu đầu ra). Lượt lịch sử đang `running` không có nút Hủy.

## 4. Tình huống test

Component test, mock `agent-client`, `editor-client`, `project-client` bằng `vi.spyOn`; sự kiện server bằng `FakeSocket` như lượt 5.

| #   | Tình huống                                                                                                                     | Kỳ vọng                                                                                                        | Mã              |
| --- | ------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------- | --------------- |
| 1   | `job.completed` với `TurnSummary` 3 file (`src/App.tsx` modified, `src/pages/New.tsx` created, `public/old.png` deleted)       | `chat-files` có 3 dòng đúng thứ tự, `data-change` đúng; nút mở editor có ở 2 dòng đầu, **không** có ở dòng xóa | [R-CH-04]       |
| 2   | Bấm dòng `src/App.tsx`; `fetchTurnDiff` trả diff có header, một dòng `@@`, một dòng `-old`, một dòng `+new`, hai dòng ngữ cảnh | `fetchTurnDiff(turnId, 'src/App.tsx')`; `chat-diff-line` có đúng `data-kind` từng dòng; bấm lại thì diff đóng  | [R-CH-04, S-16] |
| 3   | Diff chứa `+<script>alert(1)</script>` và `+<img src=x onerror=alert(1)>`                                                      | Hiện nguyên văn như chữ; DOM không có `script`, `img`                                                          | [S-16]          |
| 4   | Bấm `chat-file-open-0`                                                                                                         | `openInEditor('src/App.tsx:1:1')`; khi bị từ chối E021 thì hiện câu đã dịch                                    | [R-CH-04]       |
| 5   | Bấm `chat-revert` → `chat-revert-cancel`                                                                                       | Hộp xác nhận nêu "3 file"; hủy thì `revertTurn` **không** được gọi                                             | [R-CH-04]       |
| 6   | `chat-revert` → `chat-revert-confirm`; `revertTurn` trả `revertible: false`                                                    | `revertTurn(turnId)` một lần; `chat-reverted` hiện; nút `chat-revert` biến mất                                 | [R-CH-04]       |
| 7   | `revertTurn` từ chối E017 `{ file: 'src/App.tsx', reason: 'fileChanged' }`                                                     | `chat-revert-error` có câu E017 chứa `src/App.tsx`; nút Hoàn tác vẫn còn                                       | [R-CH-04]       |
| 8   | `TurnSummary` có 120 file                                                                                                      | Số dòng `chat-file-*` trong DOM **ít hơn** 120 (ảo hóa); cuộn khung tới cuối thì thấy dòng cuối                | [R-CH-04]       |
| 9   | Mở tab AI, `fetchTurns` trả 2 lượt (một `completed` có file, một `failed`)                                                     | Hai lượt hiện cũ trước với yêu cầu, tóm tắt, file; lượt `completed` có nút Hoàn tác                            | [R-CH-05]       |
| 10  | Lượt của phiên vừa xong (`turnId: 't1'`), sau đó `fetchTurns` trả cả `t1`                                                      | `t1` chỉ hiện **một** lần                                                                                      | [R-CH-05]       |
| 11  | Gửi một lượt (`conversation: 'new'`), lượt hai (`'continue'`), bấm `chat-new-conversation`, gửi lượt ba                        | Lượt ba gửi `conversation: 'new'`; `chat-divider` hiện sau lượt hai                                            | [R-CH-05]       |
| 12  | Đang có lượt chạy                                                                                                              | `chat-new-conversation` vô hiệu                                                                                | [R-CH-05]       |

## 5. Kiểm tay (chủ dự án)

`npm run dev`, dự án mới đã tin cậy, tab AI.

1. Gửi "Đổi tiêu đề trang Home thành Xin chào" (trả lời "Đồng ý" nếu agy hỏi). Xong: danh sách có `src/pages/Home.tsx`.
2. Bấm vào file: diff hiện một dòng đỏ (cũ) và một dòng xanh (mới).
3. Bấm **Mở trong editor**: VS Code mở đúng file.
4. Bấm **Hoàn tác lượt này** → Đồng ý: Canvas về tiêu đề cũ; dòng "Đã hoàn tác".
5. Làm lại bước 1, sửa tay `Home.tsx` trong VS Code, rồi bấm Hoàn tác: báo file đã bị sửa thêm, không đổi gì.
6. Tải lại trang Studio (F5), mở tab AI: các lượt vừa rồi vẫn hiện.
7. Bấm **Hội thoại mới**, gửi "Bạn vừa làm gì?": agent không nhớ lượt trước (hội thoại mới).

## 6. Bẫy đã biết

1. `useVirtualizer` với React Compiler: viết hook riêng `useVirtualFileRows(count, scrollRef)` trả `{ items: virtualizer.getVirtualItems(), totalSize: virtualizer.getTotalSize() }`, đầu file hook ghi `'use no memo';` (chỉ thị chính thức của React Compiler cho hook đọc giá trị thay đổi ngoài React). Component chỉ render từ kết quả của hook.
2. jsdom không có layout: test ảo hóa giả kích thước khung cuộn bằng `vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get')` và `getBoundingClientRect`, khôi phục ở `afterEach`. `estimateSize` cố định (ví dụ 28 px).
3. Không dùng `dangerouslySetInnerHTML` cho diff.
4. Thời gian `startedAt`: `Intl.DateTimeFormat(i18n.language, { dateStyle: 'short', timeStyle: 'short' })`.
5. Không lách luật lint bằng mẹo. Gặp luật cản thì đổi thiết kế hoặc dừng và báo.

## 7. Báo cáo và commit

Báo cáo: file tạo và sửa (kèm số dòng), bảng 12 tình huống → tên test, kết quả `pnpm verify` (số test), chỗ nào làm khác bản này và vì sao.

Commit (đã qua commitlint):

```
feat(studio): review, revert and recall agent turns in chat
```
