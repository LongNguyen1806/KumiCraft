# Bước 1C — Sửa chữ trực tiếp, không định dạng (M-OV)

WP-1.07, phần 3/4. Module: M-OV. Spec: SPEC-04.1 mục 8.4 (các bước 1, 3 đến 7). Yêu cầu: 1B đã xong và đã commit.

Phạm vi bước này: **chữ thuần**. Trình soạn rich text (bước 2 của mục 8.4: đậm, nghiêng, liên kết, thanh công cụ nổi) thuộc WP-2.09, **không làm ở đây**. Trong WP-1.07, `Text` và `Heading` cũng sửa bằng chữ thuần.

## Mục tiêu

Nhấp đúp vào chữ trên Canvas, gõ, Enter: chữ đổi, đúng một bước Undo. Gõ tiếng Việt kiểu Unikey/EVKey/Telex không mất hay lặp ký tự.

## Phạm vi (chỉ được sửa/thêm)

- `packages/studio/src/features/overlay/text-edit/**` (mới: logic + hook + test)
- `packages/studio/src/features/canvas/node-registry/*.tsx` (chỉ 4 renderer: `TextNode`, `HeadingNode`, `ButtonNode`, `LinkNode`)
- `packages/studio/src/features/canvas/canvas-node.tsx` (chỉ phần truyền trạng thái đang sửa)
- `packages/studio/src/features/overlay/` (chỉ phần gắn sự kiện `dblclick`)
- i18n `overlay.*`, `e2e/canvas-text-edit.e2e.ts` (mới)

Không thêm thư viện. Không dùng TipTap ở bước này.

## Việc cần làm

### A. Node nào sửa được

| Loại node                           | Trường sửa     | Điều kiện                                                                           |
| ----------------------------------- | -------------- | ----------------------------------------------------------------------------------- |
| `Button`, `Link`, `Text`, `Heading` | `content.text` | Không có binding `text` (`node.bindings?.text` rỗng) **và** không có `content.runs` |

- Có binding `text` → không vào chế độ sửa; hiện gợi ý "Nội dung lấy từ dữ liệu" (mục 8.4 bước 7), khóa i18n `overlay.textFromData`.
- Có `runs` (đã có định dạng) → không vào chế độ sửa, hiện gợi ý "Nội dung có định dạng, sẽ sửa được ở bản rich text" (khóa `overlay.textHasFormat`). **Không được âm thầm bỏ định dạng của người dùng.**
- Gợi ý hiện bằng một dòng `role="status"` trong thanh trạng thái hoặc nổi cạnh node, tự tắt sau 3 giây.
- Node `locked` hoặc nằm trong thân `ComponentInstance` (`data-rc-inner`) không sửa được.

### B. Vào chế độ sửa

- `dblclick` (pha capture, trong `iframeDocument`) trên phần tử thuộc node sửa được: chọn node đó (nếu chưa chọn), rồi sửa.
- Đặt `contenteditable="plaintext-only"` trên chính phần tử `data-rc-node`. Trình duyệt nào không hỗ trợ `plaintext-only` (kiểm tra bằng cách gán rồi đọc lại `contentEditable`) thì dùng `"true"` và **chặn dán HTML**, chỉ chèn `text/plain` (xử lý sự kiện `paste` bằng `clipboardData.getData('text/plain')` và `document.execCommand('insertText')` hoặc `Selection`/`Range`).
- Focus vào phần tử, chọn toàn bộ chữ.
- Lưu `original` = `content.text` hiện tại.
- Quản lý "đang sửa" bằng một store nhỏ (`useTextEditStore`: `editingNodeId`, `session`) trong `features/overlay/text-edit/`.

### C. Tránh xung đột với React

Phần tử đang sửa do React quản lý; người dùng gõ làm trình duyệt đổi/bỏ text node mà React nắm, lần cập nhật sau React có thể báo lỗi `removeChild`. Yêu cầu:

- Khi `editingNodeId === node.id`, renderer của node đó vẽ **chuỗi gốc đóng băng** (`original`), không đọc `content.text` mới.
- Khi thoát chế độ sửa (xác nhận hoặc huỷ), **đổi `key`** của phần tử (ví dụ `key={`${node.id}:${session}`}`) để React tạo lại phần tử từ đầu. Như vậy DOM không còn dấu vết của lần sửa.
- Kiểm tra bằng E2E: sửa cùng một node hai lần liên tiếp, rồi Undo, rồi Redo; **không** có `console.error`/`pageerror`.

### D. Kết thúc

Hàm thuần `finishTextEdit({ original, edited, nodeType })` trong `text-edit/finish-text-edit.ts`, trả `{ kind: 'commit', text } | { kind: 'cancel' }`:

- Lấy `edited` từ `element.innerText` (đã chuẩn hoá xuống dòng thành `\n`), bỏ ký tự điều khiển, cắt ` ` thừa ở cuối do trình duyệt thêm.
- `Button`, `Link`, `Heading`: xoá mọi `\n` (một dòng). `Text`: giữ `\n` (từ Shift+Enter). Hiển thị `\n` trên Canvas bằng `white-space: pre-line` đặt trên `Text` và `Heading` (sửa renderer).
- `edited` rỗng sau khi cắt, hoặc bằng `original` → `cancel` (không tạo thao tác nào).
- Còn lại → `commit`.

Cách kết thúc:

| Hành động                                                                                      | Kết quả                                                                          |
| ---------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `Enter` (không Shift), **không** đang trong lúc gõ bộ gõ (`event.isComposing` / `keyCode 229`) | Xác nhận                                                                         |
| Bấm ra ngoài (blur, hoặc click sang node khác/ vùng nền)                                       | Xác nhận (nếu đang gõ dở bộ gõ, đợi `compositionend` rồi mới xác nhận)           |
| `Shift+Enter`                                                                                  | Xuống dòng (Text); Button/Link/Heading bỏ qua                                    |
| `Esc`                                                                                          | Huỷ, khôi phục chữ cũ, **không** bỏ chọn node (Esc thứ hai mới bỏ chọn, theo 1B) |
| Dán                                                                                            | Chỉ chữ thuần, mọi định dạng bị bỏ                                               |

Xác nhận = đúng **một** thao tác:

```ts
dispatch([{ op: 'setContent', target: { kind: 'page', pageId }, nodeId, set: { text } }], {
  source: 'user',
  label: 'Edit text',
});
```

(`setContent` với `set` một phần: xem `packages/model/src/operations/operation.schema.ts` và ví dụ `setText` trong `packages/studio/src/store/test-support.ts`.) Nếu `dispatch` trả lỗi, hiện lỗi cạnh node và giữ nguyên chữ cũ, không để chữ người dùng gõ biến mất mà không báo.

### E. Không tranh phím

- Trong lúc sửa, `Ctrl/Cmd+Z`, `Ctrl+A`, `Delete`, `Backspace`, mũi tên là của ô sửa (Undo gốc của trình duyệt), **không** gọi Undo của Studio. Kiểm tra `use-editor-shortcuts.ts`: phím từ trong iframe không tới được `window` cha, nhưng phải có test chứng minh Undo của Studio không chạy khi đang sửa.
- Trong lúc sửa: tắt hover box; `mousedown` trong phần tử đang sửa **không** bị `preventDefault` (để đặt con trỏ chuột); 1B có cờ cho việc này.
- Phím `Esc` của 1B (bỏ chọn) nhường cho chế độ sửa.

## Kiểm tra (dán kết quả thật)

1. `pnpm verify` mã thoát 0 (ghi số test cũ/mới).
2. Test đơn vị `finishTextEdit`: không đổi, rỗng, có `\n` với từng loại node, ` ` cuối, chuỗi dài.
3. `e2e/canvas-text-edit.e2e.ts` xanh trên Chromium, Firefox, WebKit:
   - Nhấp đúp Button, Link, Text, Heading → gõ → Enter → chữ đổi trong Layer Tree và Canvas; **một** lần Undo trả về chữ cũ, Redo làm lại.
   - Esc huỷ; click ra ngoài xác nhận; Shift+Enter ở Text tạo xuống dòng hiển thị đúng; ở Button không tạo.
   - Node có `runs`, node có binding `text`: nhấp đúp không vào chế độ sửa, hiện đúng gợi ý, tài liệu không đổi.
   - Dán HTML (đậm, liên kết) vào ô sửa: kết quả là chữ thuần.
   - Sửa hai lần liên tiếp cùng node rồi Undo/Redo: không lỗi console.
   - Ctrl+Z trong lúc sửa không làm Undo thiết kế.
   - **Tiếng Việt**: mô phỏng gõ kiểu Unikey (gõ `chao` rồi xoá lùi và gõ lại ký tự có dấu) với câu mẫu 200 ký tự trong `scripts/vg/vg-14.mjs` (biến `SAMPLE`); chữ cuối cùng khớp từng ký tự. Trên Chromium dùng thêm mô phỏng composition qua CDP như script đó. Tái sử dụng cách làm của script, không viết lại từ đầu.
4. `pnpm lint` 0 cảnh báo, `pnpm check:i18n` sạch, không `eslint-disable` mới.

## Chủ sản phẩm thử tay (ghi vào báo cáo, không phải việc của AI)

Mở Studio, nhấp đúp chữ, gõ một câu tiếng Việt có dấu bằng Unikey hoặc EVKey thật (và bộ gõ macOS nếu có), Enter. Chữ phải đúng từng dấu.

## Không được làm

- Không dùng TipTap, không làm thanh định dạng nổi, không đọc/ghi `runs`.
- Không để người dùng sửa node có `runs` hoặc binding bằng cách bỏ định dạng/ngắt binding.
- Không thêm phím tắt toàn cục.
