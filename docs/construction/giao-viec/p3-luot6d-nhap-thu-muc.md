# Phase 3 — Lượt 6d: Thanh công cụ ô chat, nút "Import folder" và gửi ảnh (R-CH-02, R-MR-01)

Đọc `README.md` cùng thư mục trước, nhất là mục **"Lỗi lint hay vấp"**, rồi làm đúng bản này. Yêu cầu của chủ dự án (2026-10-23, kèm ảnh chụp ô chat):

- dời phần "Thêm backend" và đính kèm lên **đầu** ô chat;
- gộp thành **một** nút icon thư mục có dấu +, di chuột vào hiện "Import folder";
- người dùng nhập backend hay tài liệu gì cũng được, AI tự đọc;
- ô chat phải **gửi được ảnh** (dán Ctrl+V, kéo thả, nút chọn ảnh).

Lượt có hai phần:

- **A. Import folder** (mục 1 đến 7, chỉ Studio). Server đã đủ:
  - `POST /project/backends` thêm thư mục ngoài dự án thành bản sao chỉ đọc cho AI (R-MR-01, tối đa 10, E016 `cannotMatchProjectRoot`, `duplicateBackend`, `maxBackendsExceeded`; E015 khi không có thư mục);
  - `docs` của `POST /agent/turns` nhận đường dẫn tương đối trong dự án, **file hoặc thư mục** (server kiểm bằng `lstat`).
- **B. Gửi ảnh** (mục 8: shared, server, Studio).

Cả lượt không sửa Bridge, `e2e/`, `docs/spec.md`, `buildArgs`/`parseLine` của adapter.

## 1. Mục tiêu phần A (người dùng thấy gì)

1. **Thanh đầu ô chat** (một hàng, như ảnh của chủ dự án):
   - bên trái: `+ Hội thoại mới`, **nút icon `FolderPlus`** và **nút icon `ImagePlus`** (phần B), đều từ lucide;
   - bên phải: `AgentBadge` như hiện nay;
   - di chuột vào icon thư mục hiện "Nhập thư mục" (en "Import folder"), có `aria-label` cùng nội dung.
2. **Hàng chip ngay dưới thanh đầu** ("AI đọc thêm"): chip backend (tên, nút xóa), chip tài liệu (đường dẫn, nút xóa), ảnh thu nhỏ (phần B).
   - Không có chip thì hàng ẩn.
   - Chip backend có icon `Server`. Chip tài liệu có icon `FileText`, hoặc `Folder` khi đường dẫn không có phần mở rộng.
   - **Chip backend và tài liệu giữ nguyên qua các tin nhắn cho tới khi người dùng bấm xóa.** Tài liệu không còn tự mất sau khi gửi. Ảnh thì gửi xong mới bỏ (mục 8.1).
3. **Phía dưới ô chat** chỉ còn chip ngữ cảnh (trang, khung) và ô nhập. Bỏ nút "Thêm backend" và nút ghim cũ.
4. **Bấm nút Import folder** → hộp thoại "Nhập thư mục hoặc tài liệu":
   - `DirectoryBrowser` (component có sẵn của hộp Mở dự án) để duyệt và chọn thư mục, bắt đầu ở thư mục gốc dự án;
   - ô đường dẫn sửa được: gõ đường dẫn tuyệt đối, hoặc tương đối với dự án (gõ được cả **file**, ví dụ `docs/api.md`);
   - một dòng giải thích, đổi theo đường dẫn đang chọn:
     - trong dự án: "AI sẽ đọc `src/pages` ở các tin nhắn tiếp theo.";
     - ngoài dự án: "AI sẽ đọc bản sao chỉ đọc của `D:\work\api` ở các tin nhắn tiếp theo. AI không sửa được thư mục gốc.";
     - chính thư mục dự án: "Đây là thư mục dự án, AI đã đọc sẵn." và nút Thêm bị khóa;
   - nút **Thêm** và **Hủy**.
5. **Bấm Thêm:**
   - Trong dự án → thêm vào `docs` của chat-store (đường dẫn tương đối, dấu `/`), không gọi server. Trùng thì không thêm lần hai.
   - Ngoài dự án → `addBackend(path)` như nút cũ. Lỗi hiện câu đã dịch ngay trong hộp, không đóng hộp.
   - Xong thì đóng hộp; chip mới hiện ở hàng chip.

## 2. Đọc trước (CW-52)

| File                                                                                                                                           | Lý do                                                       |
| ---------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| `packages/studio/src/features/chat/chat-panel.tsx`, `chat-backends.tsx`, `chat-docs.tsx`, `chat-store.ts`, `chat-input.tsx`, `chat-thread.tsx` | Bố cục hiện tại, chip, thêm backend, `docs`, gửi lượt       |
| `packages/studio/src/features/project/directory-browser.tsx`, `project-dialog.tsx`                                                             | `DirectoryBrowser` (`currentPath`, `onSelectPath`) dùng lại |
| `packages/studio/src/api/project-client.ts`, `agent-client.ts`                                                                                 | `addBackend`, `removeBackend`, `fetchProject`, `startTurn`  |
| `packages/studio/src/components/ui/dialog.tsx`                                                                                                 | Hộp thoại                                                   |
| `packages/shared/src/agent.ts`                                                                                                                 | `StartTurnRequestSchema` (phần B)                           |
| `packages/server/src/core/project/images.ts`                                                                                                   | `detectImageKind` (nhận dạng ảnh bằng byte đầu) dùng lại    |
| `packages/server/src/core/agent/turn-runner.ts`, `prompt.ts`, `turn-runner.test.ts`                                                            | Nơi gom `mirrorDirs`, dựng lời nhắc (phần B)                |
| `packages/server/src/adapters/http/routes/agent-turns.ts`, `routes/source.ts` (dòng có `bodyLimit`)                                            | Mẫu route, cách đặt `bodyLimit` riêng cho một route         |
| Test hiện có dùng `chat-add-backend`, `chat-attach`, `chat-doc-input`, `chat-backend-confirm`                                                  | Sẽ phải viết lại theo giao diện mới                         |

## 3. Hợp đồng phần A

### 3.1. Hàm thuần `features/chat/import-path.ts`

```ts
export type ImportTarget =
  | { readonly kind: 'doc'; readonly relPath: string } // trong dự án, dấu '/'
  | { readonly kind: 'backend'; readonly path: string } // tuyệt đối, ngoài dự án
  | { readonly kind: 'projectRoot' }
  | { readonly kind: 'invalid' }; // rỗng, ký tự lạ
export function classifyImport(projectRoot: string, input: string): ImportTarget;
```

- Đường dẫn tuyệt đối:
  - Windows: `C:\…`, `C:/…`, `\\server\share`; POSIX: bắt đầu bằng `/`.
  - Đường dẫn tương đối là so với `projectRoot`.
- So sánh "nằm trong dự án":
  - chuẩn hóa `\` thành `/`, bỏ `/` cuối, xử lý `.` và `..`;
  - **không phân biệt hoa thường** khi `projectRoot` là đường dẫn Windows (có ổ `X:` hoặc `\\`);
  - `D:\proj-old` **không** nằm trong `D:\proj` (so theo từng đoạn, không so tiền tố chuỗi).
- Tương đối mà thoát ra ngoài (`../api`) → giải thành tuyệt đối. Ngoài dự án thì `backend`, với đường dẫn chuẩn hóa theo kiểu của `projectRoot` (Windows dùng `\`).
- Kết quả `doc` không bao giờ bắt đầu bằng `/` hay chứa `..`.

### 3.2. Component

| File                                       | `data-testid`                                                                                                                  | Nội dung                                                                                                                                                             |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `features/chat/chat-toolbar.tsx` (mới)     | `chat-toolbar`, `chat-import`, `chat-add-image`                                                                                | Thanh đầu: Hội thoại mới, nút Import folder, nút thêm ảnh (`title` + `aria-label`), `AgentBadge`                                                                     |
| `features/chat/chat-attachments.tsx` (mới) | `chat-attachments`, giữ `chat-backend-<id>`, `chat-doc-<index>`, thêm `chat-image-<index>`                                     | Hàng chip backend, tài liệu, ảnh; nút xóa giữ hành vi cũ; lỗi xóa backend hiện `chat-backend-error`                                                                  |
| `features/chat/import-dialog.tsx` (mới)    | `chat-import-dialog`, `chat-import-path`, `chat-import-hint`, `chat-import-confirm`, `chat-import-cancel`, `chat-import-error` | Mục 1.4, 1.5                                                                                                                                                         |
| `chat-backends.tsx`, `chat-docs.tsx`       | —                                                                                                                              | Bỏ nút và ô nhập cũ. Phần chip và `useProjectBackends` chuyển sang `chat-attachments.tsx` (hoặc giữ file, chỉ xuất phần dùng lại). Không để code chết                |
| `chat-store.ts`, `chat-input.tsx`          | —                                                                                                                              | `docs` **không** bị xóa sau khi gửi (mục 1.2)                                                                                                                        |
| `chat-panel.tsx`                           | —                                                                                                                              | Bố cục: `ChatToolbar` → `ChatAttachments` → luồng → `ChatContext` + `AgentLoginCard` + `ChatInput`. Bước onboarding (install/choose) **không** có thanh công cụ nhập |

- `DirectoryBrowser` dùng nguyên, không đổi hành vi của hộp Mở dự án. Chọn thư mục trong browser thì điền vào `chat-import-path`.
- Màu chỉ dùng token của Studio, **không** có `brand`.

### 3.3. i18n (namespace `chat`, vi và en)

| Khóa                          | vi                                                                                              | en                                                                                                    |
| ----------------------------- | ----------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `import.button`               | Nhập thư mục                                                                                    | Import folder                                                                                         |
| `import.title`                | Nhập thư mục hoặc tài liệu                                                                      | Import a folder or document                                                                           |
| `import.hintDoc`              | AI sẽ đọc {{path}} ở các tin nhắn tiếp theo.                                                    | The AI will read {{path}} with your next messages.                                                    |
| `import.hintBackend`          | AI sẽ đọc bản sao chỉ đọc của {{path}} ở các tin nhắn tiếp theo. AI không sửa được thư mục gốc. | The AI will read a read-only copy of {{path}} with your next messages. It cannot change the original. |
| `import.hintRoot`             | Đây là thư mục dự án, AI đã đọc sẵn.                                                            | This is the project folder; the AI already reads it.                                                  |
| `import.add`, `import.cancel` | Thêm / Hủy                                                                                      | Add / Cancel                                                                                          |
| `image.button`                | Thêm ảnh                                                                                        | Add image                                                                                             |

Thêm các câu cho phần B (ảnh đang tải, ảnh bị từ chối). Bỏ khóa không còn dùng (`addBackend`, khóa của nút ghim…) ở cả vi và en; `check:i18n` phải xanh.

## 4. Tình huống test phần A

| #   | Tình huống                                                                                                                                                                  | Kỳ vọng                                                                                                                                                                                | Mã                 |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ |
| 1   | `classifyImport('D:\\proj', …)` với `src/pages`, `D:\\proj\\docs\\a.md`, `d:/PROJ/src`, `D:\\proj`, `D:\\proj\\`, `D:\\proj-old`, `..\\api`, `E:\\api`, `''`, `src/../../x` | doc `src/pages`; doc `docs/a.md`; doc `src`; projectRoot; projectRoot; backend `D:\\proj-old`; backend `D:\\api`; backend `E:\\api`; invalid; backend `D:\\x`                          | [R-CH-02, R-MR-01] |
| 2   | `classifyImport('/home/a/proj', …)` với `/home/a/proj/src`, `/home/a/Proj/src`, `/srv/api`, `./docs`                                                                        | doc `src`; backend `/home/a/Proj/src` (POSIX phân biệt hoa thường); backend `/srv/api`; doc `docs`                                                                                     | [R-CH-02]          |
| 3   | Ô chat sẵn sàng                                                                                                                                                             | `chat-toolbar` có `chat-new-conversation`, `chat-import` (có `title` và `aria-label` "Nhập thư mục"), `chat-add-image`, `agent-badge`; **không** còn `chat-add-backend`, `chat-attach` | [R-CH-02]          |
| 4   | Bấm `chat-import`, gõ `src/pages`                                                                                                                                           | `chat-import-hint` là câu "AI sẽ đọc src/pages ở các tin nhắn tiếp theo."; Thêm → chip `chat-doc-0` "src/pages"; `addBackend` **không** được gọi                                       | [R-CH-02]          |
| 5   | Gõ `D:\\work\\api` (ngoài dự án), bấm Thêm                                                                                                                                  | `addBackend('D:\\work\\api')` một lần; hộp đóng; chip `chat-backend-<id>` hiện                                                                                                         | [R-MR-01]          |
| 6   | `addBackend` từ chối E016 `maxBackendsExceeded`                                                                                                                             | `chat-import-error` có câu đã dịch; hộp **vẫn mở**                                                                                                                                     | [R-MR-01]          |
| 7   | Gõ đúng thư mục dự án                                                                                                                                                       | Câu `hintRoot`; `chat-import-confirm` bị khóa                                                                                                                                          | [R-CH-02]          |
| 8   | Thêm `src/pages` hai lần                                                                                                                                                    | Chỉ một chip                                                                                                                                                                           | [R-CH-02]          |
| 9   | Có một backend và một tài liệu; bấm xóa từng chip                                                                                                                           | `removeBackend(id)` được gọi; tài liệu bị bỏ khỏi `docs`; hàng `chat-attachments` ẩn khi hết chip                                                                                      | [R-CH-02, R-MR-01] |
| 10  | Gửi hai tin nhắn liên tiếp khi có tài liệu `src/pages`                                                                                                                      | Cả hai lần `startTurn` nhận `docs: ['src/pages']`; chip vẫn còn sau khi gửi                                                                                                            | [R-CH-02]          |
| 11  | Chọn một thư mục trong `DirectoryBrowser` của hộp                                                                                                                           | `chat-import-path` đổi theo đường dẫn đã chọn                                                                                                                                          | [R-CH-02]          |
| 12  | Bước onboarding (chưa cài agent)                                                                                                                                            | Không có `chat-import`, `chat-add-image`                                                                                                                                               | [R-AG-21]          |

Test cũ dùng `chat-add-backend`, `chat-attach`, `chat-doc-input`, `chat-backend-confirm`: viết lại theo luồng mới (`chat-import` → `chat-import-path` → `chat-import-confirm`), **giữ nguyên ý kiểm** (thêm, xóa, lỗi, `docs` gửi lên). Không xóa test mà không có test thay thế. Test cũ kiểm "tài liệu bị xóa sau khi gửi" thì đổi theo hành vi mới (mục 1.2) và ghi trong báo cáo.

## 5. Kiểm tay (chủ dự án)

1. Tab AI: thanh đầu có `+ Hội thoại mới`, icon thư mục có dấu +, icon ảnh, và bên phải "Antigravity CLI · Đã đăng nhập". Di chuột vào icon thư mục hiện "Nhập thư mục".
2. Bấm icon thư mục, duyệt tới một thư mục ngoài dự án (ví dụ một backend) → Thêm: chip có icon server hiện ở đầu ô chat.
3. Bấm icon thư mục, gõ `src/pages` → Thêm. Gửi "Liệt kê các trang trong thư mục đính kèm": agent trả lời đúng. Chip vẫn còn.
4. Chụp màn hình một trang web (Win+Shift+S), bấm vào ô nhập rồi **Ctrl+V**: ảnh thu nhỏ hiện ở hàng chip. Gửi "Làm trang Home giống ảnh này": agent đọc ảnh (thấy bước `read_file` với đường dẫn ảnh) và sửa trang.
5. Kéo một file ảnh từ Explorer thả vào ô chat: ảnh thu nhỏ hiện. Thả file `.txt`: báo không phải ảnh.

## 6. Bẫy đã biết

1. Không so "nằm trong dự án" bằng `startsWith` chuỗi (lỗi `D:\proj-old`). So từng đoạn sau khi chuẩn hóa.
2. Không dùng `path` của Node trong Studio (chạy trên trình duyệt); tự viết hàm chuẩn hóa nhỏ, test kỹ.
3. Không `null`, `as`, `any`, `!`, eslint-disable. Ref dùng `el ?? undefined`.
4. Hàm ≤ 50 dòng, file ≤ 400 dòng.
5. `URL.createObjectURL` cho ảnh thu nhỏ phải `revokeObjectURL` khi bỏ ảnh hoặc unmount.
6. Ảnh lưu ở **thư mục cache của ReactCraft**, **không bao giờ** ghi vào dự án người dùng.
7. Không lách luật lint bằng mẹo. Gặp luật cản thì đổi thiết kế hoặc dừng và báo.

## 7. Spec-log (số tiếp theo sau #52)

- `#53` R-CH-02, R-MR-01: một nút "Import folder" ở đầu ô chat. Đường dẫn trong dự án (file hoặc thư mục) thành tài liệu đính kèm; ngoài dự án thì thành backend tham khảo (bản sao chỉ đọc). Chip giữ qua các tin nhắn tới khi người dùng xóa. Theo yêu cầu chủ dự án 2026-10-23.
- `#54` R-CH-02: gửi ảnh trong chat (dán, kéo thả, nút chọn). Ảnh lưu ở cache của ReactCraft, agent đọc qua `--add-dir` và danh sách đường dẫn trong lời nhắc (đã thử agy `read_file` đọc được ảnh, 2026-10-23). Lịch sử lượt không lưu ảnh.

## 8. Phần B: gửi ảnh

### 8.1. Người dùng thấy gì

1. Ba cách thêm ảnh:
   - **Ctrl+V** trong ô nhập khi clipboard có ảnh;
   - **kéo thả** file ảnh vào ô chat;
   - nút **`ImagePlus`** ở thanh đầu mở hộp chọn file (`<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" multiple>` ẩn).
2. Mỗi ảnh hiện thành **ảnh thu nhỏ** 48 px trong hàng chip, có nút xóa và vòng quay khi đang tải lên. Lỗi (sai loại, quá lớn, quá 5 ảnh) hiện câu đã dịch dưới hàng chip, ảnh lỗi không được thêm.
3. Đang tải ảnh thì nút Gửi bị khóa. Gửi được khi có chữ; ảnh không thay được chữ.
4. Gửi xong: tin nhắn của người dùng trong luồng chat hiện các ảnh thu nhỏ phía trên chữ, và hàng chip bỏ các ảnh (ảnh chỉ đi theo **một** tin nhắn).
5. Lượt lịch sử nạp lại từ server **không** có ảnh (spec-log #54).

### 8.2. Shared (`agent.ts`)

```ts
export const CHAT_IMAGE_KINDS = ['png', 'jpg', 'webp', 'gif'] as const;
export const ChatImageUploadSchema = z.strictObject({
  kind: z.enum(CHAT_IMAGE_KINDS),
  dataBase64: z.string().min(1).max(7_000_000), // ≈ 5 MB sau khi giải mã
});
export const ChatImageSchema = z.strictObject({ id: z.string().regex(/^[A-Za-z0-9_-]{10}$/) });
```

`StartTurnRequestSchema` thêm `images: z.array(z.string().regex(/^[A-Za-z0-9_-]{10}$/)).max(5).default([])`. Dùng `.default([])` để client cũ và test cũ không phải gửi trường này. Nếu `strictObject` với `default` làm vướng kiểu ở chỗ khác thì dùng `.optional()` và coi thiếu là `[]`.

### 8.3. Server

**Kho ảnh `core/agent/chat-images.ts` (mới):**

- `createChatImageStore({ fs, cacheDir, now, newId })`.
- `save(projectId, kind, bytes)`:
  - giải mã xong mà quá 5 MB → E016 `{ reason: 'imageTooLarge' }`;
  - `detectImageKind(bytes)` (từ `core/project/images.ts`) khác `kind`, hoặc là `svg` → E016 `{ reason: 'notAnImage' }`;
  - ghi `chat-images/<projectId>/<id>.<ext>` dưới `cacheDir` bằng `writeBytesAtomic`; trả `{ id }`;
  - mỗi lần lưu, xóa ảnh của dự án đó cũ hơn **7 ngày**.
- `resolve(projectId, ids)`: trả đường dẫn tuyệt đối từng ảnh; thiếu ảnh nào → E015 `{ resource: 'image', id }`.
- `dirOf(projectId)`: đường dẫn tuyệt đối thư mục ảnh của dự án.

**REST (`routes/agent-turns.ts` hoặc file route mới):**

- `POST /agent/images`, body `ChatImageUpload`, `bodyLimit: 8 * 1024 * 1024` riêng cho route (mẫu ở `routes/source.ts`).
- Cần dự án mở và đã tin cậy (E021 `project`, E011 như `POST /agent/turns`).
- Trả 201 `{ data: { id } }`.

**Lượt AI (`turn-runner.ts`, `prompt.ts`):**

- `request.images` không rỗng:
  - `resolve` trước khi chạy job; lỗi thì trả lỗi như `docs` (E015);
  - thêm `dirOf(projectId)` vào **cuối** `mirrorDirs` (adapter giữ nguyên `buildArgs`, chỉ nhận thêm một `--add-dir`);
  - `buildPrompt` thêm mục `Images the user attached (read them with your file tools):` kèm từng đường dẫn tuyệt đối.
- Không có ảnh thì lời nhắc và tham số **giống hệt** trước đây (test cũ của `prompt`, `turn-runner` phải xanh nguyên).
- Composition root: truyền `cacheDir` sẵn có của `ServiceDeps`.

### 8.4. Studio

- `api/agent-client.ts`: `uploadChatImage(kind, dataBase64): Promise<{ id: string }>`.
- `features/chat/use-chat-images.ts`:
  - nhận `File`; đọc bằng `FileReader.readAsDataURL`, cắt phần base64;
  - xác định `kind` theo `file.type` (`image/png` → `png`, `image/jpeg` → `jpg`, `image/webp`, `image/gif`); loại khác thì báo lỗi, không gọi server;
  - quá 5 MB báo lỗi ngay ở client;
  - tối đa 5 ảnh;
  - giữ `previewUrl` (object URL) + `id` khi tải xong.
- `chat-store.ts`: `images: readonly { localId, previewUrl, id?, state: 'uploading' | 'ready' }[]`; `ChatItem` kiểu `user` thêm `images?: readonly string[]` (preview URL) để luồng chat hiện ảnh.
- `chat-input.tsx`:
  - `onPaste` lấy `clipboardData.files` là ảnh (có ảnh thì `preventDefault`; chỉ có chữ thì dán chữ bình thường);
  - vùng ô chat nhận `onDragOver` / `onDrop`;
  - gửi `images: ids đã ready`; gửi xong bỏ ảnh khỏi hàng chip (không revoke URL đang dùng trong luồng chat; revoke khi `reset`/`newConversation` hoặc unmount panel).

### 8.5. Tình huống test phần B

| #   | Tình huống                                                                              | Kỳ vọng                                                                                                                      | Mã        |
| --- | --------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | --------- |
| 13  | Kho ảnh: PNG thật 1 KB                                                                  | File ở `cacheDir/chat-images/<projectId>/<id>.png`, `resolve` trả đúng đường dẫn tuyệt đối                                   | [R-CH-02] |
| 14  | Kho ảnh: nói `png` nhưng byte là chữ; byte là SVG; 5 MB + 1 byte                        | E016 `notAnImage`; E016 `notAnImage`; E016 `imageTooLarge`; **không** ghi file                                               | [R-CH-02] |
| 15  | Kho ảnh: có ảnh 8 ngày trước và ảnh hôm qua, lưu ảnh mới                                | Ảnh 8 ngày bị xóa, ảnh hôm qua còn                                                                                           | [R-CH-02] |
| 16  | `POST /agent/images` khi chưa tin cậy dự án; khi chưa mở dự án; body 7 MB base64 hợp lệ | E011; E021; 201 (không bị 413 vì `bodyLimit` riêng)                                                                          | [R-CH-02] |
| 17  | Lượt có `images: [id]` (turn-runner thật + agent giả lập ghi `RC_FAKE_AGENT_RECORD`)    | argv có thêm `--add-dir <thư mục ảnh>` ở cuối; lời nhắc có mục ảnh với đường dẫn tuyệt đối                                   | [R-CH-02] |
| 18  | Lượt có `images: ['missingId01']`                                                       | E015 `{ resource: 'image' }`; không spawn agent                                                                              | [R-CH-02] |
| 19  | Lượt không có ảnh                                                                       | argv và lời nhắc giống hệt trước lượt này (so với test cũ)                                                                   | [R-CH-02] |
| 20  | Studio: dán (paste) một `File` `image/png` vào ô nhập                                   | `uploadChatImage('png', …)` một lần; `chat-image-0` hiện, có vòng quay rồi hết                                               | [R-CH-02] |
| 21  | Studio: dán chỉ có chữ                                                                  | Chữ vào ô nhập, `uploadChatImage` **không** được gọi                                                                         | [R-CH-02] |
| 22  | Studio: thả một file `text/plain` và một ảnh 6 MB                                       | Hai câu lỗi đã dịch; không gọi server                                                                                        | [R-CH-02] |
| 23  | Studio: thêm 6 ảnh                                                                      | Chỉ 5 ảnh, câu lỗi "tối đa 5 ảnh"                                                                                            | [R-CH-02] |
| 24  | Studio: đang tải ảnh                                                                    | `chat-send` bị khóa                                                                                                          | [R-CH-02] |
| 25  | Studio: gửi với 2 ảnh ready                                                             | `startTurn` nhận `images: [id1, id2]`; tin nhắn người dùng trong luồng có 2 ảnh thu nhỏ; hàng chip hết ảnh, tài liệu vẫn còn | [R-CH-02] |
| 26  | Studio: bấm `chat-add-image`, chọn file qua input ẩn                                    | Như #20                                                                                                                      | [R-CH-02] |

## 9. Báo cáo và commit

Báo cáo:

- file tạo và sửa, kèm số dòng;
- bảng 26 tình huống → tên test; test cũ nào đã viết lại;
- kết quả `pnpm verify` (số test);
- chỗ nào làm khác bản này và vì sao.

Commit (đã qua commitlint):

```
feat(studio): import folders and send images from the chat
```
