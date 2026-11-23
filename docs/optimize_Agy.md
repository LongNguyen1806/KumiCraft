# Lộ Trình Tối Ưu Antigravity (2026) Cho Dự Án KumiCraft

Tài liệu này tổng hợp phương án cấu hình và vận hành **Google Antigravity (CLI + Antigravity 2.0)** cho monorepo **KumiCraft** trên gói **Google AI Pro**, hướng tới độ chặt chẽ kiến trúc và kỷ luật kiểm chứng ngang Claude Code Opus mà không lãng phí quota.

---

## 1. Nguyên Tắc Vận Hành Cốt Lõi Cho KumiCraft

1. **Tách biệt quyền quyết định (không dùng `/grill-me` mặc định cho kỹ thuật):**
   - **Kiến trúc & kỹ thuật nội bộ:** AI tự đọc codebase, tự đề xuất phương án đúng chuẩn repo và nêu rõ rủi ro/đánh đổi; không đẩy câu hỏi thuần kỹ thuật về phía người dùng.
   - **Nghiệp vụ & hành vi sản phẩm (UX):** AI chỉ hỏi người dùng các quyết định thuộc về mong muốn hiển thị hoặc luồng sử dụng.
2. **Không dùng `/teamwork` trên gói Pro:**
   - `/teamwork` khởi tạo nhiều worker độc lập, làm tăng nhanh số lượt gọi và dung lượng context. Với KumiCraft, giữ 1 agent chính làm việc trên ngữ cảnh sạch hiệu quả hơn.
3. **Cơ chế Scope Gate (Duyệt 1 lần theo phạm vi):**
   - Khi người dùng chỉ hỏi hoặc trao đổi phân tích: AI tuyệt đối không sửa file.
   - Trước khi bắt đầu sửa code: AI dừng 1 nhịp để nêu ngắn gọn _nguyên nhân → phương án kỹ thuật → danh sách file sẽ sửa_ và chờ xác nhận (`ok`, `làm đi`, `đồng ý`).
   - Sau khi đã duyệt danh sách file: AI tự chạy trọn vòng lặp `sửa → kiểm thử → lint → sửa lỗi phát sinh` trên **đúng các file đã duyệt** cho tới khi pass 100% rồi mới báo cáo. Chỉ dừng hỏi lại nếu phát sinh nhu cầu sửa file ngoài phạm vi đã duyệt.
4. **Kiểm chứng thực tế kiểu Opus (không dừng ở unit test cục bộ):**
   - Mọi thay đổi chạm vào runtime (`packages/server` runners/stacks/proxy), `packages/bridge`, hoặc `packages/studio` phải chạy `pnpm build` (cập nhật `packages/cli/dist`) và chạy Playwright E2E tương ứng (`e2e/*.e2e.ts --workers=1`), đồng thời bổ sung test E2E/tour thật nếu là luồng mới chưa có test bao phủ.
5. **Phân tầng model theo độ phức tạp tác vụ:**
   - **Model nhẹ/nhanh:** tạo lệnh commit, đọc/giải thích log ngắn, sửa text/CSS nhỏ, tạo dự án mẫu đơn giản.
   - **Model mạnh (suy luận cao):** debug runtime (proxy, cookie/SameSite, HTTP 304, AST, dotnet/express runner), thiết kế luồng đa tầng, sửa lỗi kiến trúc.

---

## 2. Các Cơ Chế Mới Của Antigravity (2026) Áp Dụng Cho KumiCraft

### 2.1. Kiểm toán token nền bằng `/context`

- Lệnh `/context` hiển thị lượng token bị tiêu thụ bởi Rules, Skills, Plugins, MCP tool schemas và lịch sử hội thoại.
- **Hành động:** Trước khi bước vào phiên code KumiCraft, kiểm tra `/context` và tắt các plugin/skill/MCP không liên quan đến dự án (như `banner-design`, `brand`, `design`, `slides`, `gdocs`, `gslides`, `photoshop-assistant`…) để giảm nhiễu context và tiết kiệm quota Pro ở mọi lượt gửi.

### 2.2. Project-Level Settings & Command Allowlist (Antigravity 2.0)

- Antigravity 2.0 hỗ trợ ghi đè quyền thực thi riêng ở cấp thư mục dự án.
- **Hành động:** Cấu hình **Command Allowlist** riêng cho workspace `KumiCraft` gồm các lệnh kiểm chứng an toàn:
  - `pnpm lint:deps`, `pnpm check:i18n`, `pnpm test`, `pnpm build`
  - `npx vitest`, `npx tsc`, `npx eslint`, `npx prettier`, `npx playwright test`
- Khi kết hợp với **Scope Gate**, AI tự chạy trọn chuỗi kiểm tra sau khi sửa mà không bị ngắt quãng hỏi duyệt lệnh terminal liên tục.

### 2.3. Lifecycle Hooks thế hệ mới (`.agents/hooks.json`): Dùng `Stop` và `PreToolUse`

- **Lưu ý schema 2026:** Key cấp cao nhất của `.agents/hooks.json` phải là **tên hook** (không dùng key `"hooks"` ở root), và tên tool chỉnh sửa file hiện tại là `write_file` / `edit_file` (không phải `write_to_file` / `replace_file_content`).
- **Không dùng `PostToolUse` chạy full `typecheck && lint` toàn monorepo** sau từng lần `edit_file` vì tốn ~25–35 giây/lần.
- **Cách dùng đúng cho KumiCraft:**
  - **`Stop` hook:** Chạy 1 lần duy nhất trước khi agent kết thúc lượt. Script kiểm tra nhanh `git diff --name-only`: nếu không có file code thay đổi thì thoát ngay (`exit 0`); nếu có file `.ts`/`.tsx` thì chạy `pnpm lint:deps` (~2–3s) và `pnpm check:i18n` (nếu đụng `packages/studio/src/i18n/`). Nếu lỗi, hook trả log thẳng cho AI tự sửa trước khi bàn giao.
  - **`PreToolUse` guardrail (tùy chọn):** Chặn trước các thao tác dễ lách chuẩn repo (ví dụ không cho tự ý sửa `.dependency-cruiser-known-violations.json` khi chưa được người dùng cho phép).

### 2.4. Agent Skills với Progressive Disclosure (`.agents/skills/`)

- Legacy workflows đã bị ngừng hỗ trợ; chuẩn 2026 là **Skills** đặt tại `.agents/skills/<tên-skill>/SKILL.md`.
- Skill chỉ nạp tên và mô tả ngắn vào context mặc định, chỉ đọc nội dung chi tiết khi đúng tác vụ (Progressive Disclosure), giúp giữ context nhẹ trên gói Pro.

### 2.5. Chu kỳ `/learn` và `/compact`

- **`/learn`:** Gọi ngay sau khi xử lý xong một lỗi đặc thù của KumiCraft (như `SameSite=None; Secure` cho iframe, HTTP `304` trên HTML navigation, `stacks-apart` của `dependency-cruiser`) để lưu lại thành kinh nghiệm cho các phiên sau.
- **`/compact`:** Gọi sau mỗi task lớn (hoặc khi `/context` báo lịch sử dài) để nén ngữ cảnh, giữ độ chính xác của model và giảm lượng token lặp lại mỗi lượt.

---

## 3. Lộ Trình Triển Khai 4 Giai Đoạn

### Giai đoạn 1: Chuẩn hóa Rule toàn cục và bộ `AGENTS.md` phân tầng (Ưu tiên cao nhất)

1. **Cập nhật Rule toàn cục (`user_global`) theo cơ chế Scope Gate:**
   - Cấm sửa file khi người dùng chỉ hỏi/phân tích.
   - Bắt buộc dừng giải thích phương án + liệt kê danh sách file trước khi sửa.
   - Cho phép tự sửa lỗi phát sinh trong vòng lặp verify trên đúng danh sách file đã duyệt; chỉ dừng hỏi lại nếu cần sửa file mới ngoài phạm vi.
2. **Nâng cấp `AGENTS.md` ở root dự án:**
   - Giữ nguyên quy tắc không lách test/type và tuân thủ QC-40 (không dùng `null`, dùng ref callback).
   - Bổ sung quy tắc kiến trúc `dependency-cruiser`:
     - `packages/server/src/stacks/*/*` tuyệt đối không import chéo nhau (logic dùng chung đặt trong `packages/server/src/lib/`).
     - `lib/` không import `services|stacks|adapters`; `services/` và `adapters/` không import `stacks/`.
   - Bổ sung chuẩn `commitlint`: `<type>(<scope>): <chữ thường toàn bộ, tối đa 72 ký tự>`.
   - Bổ sung checklist kiểm chứng bắt buộc trước khi báo xong.
3. **Tạo `AGENTS.md` cục bộ theo package (Directory-Based Rules, tự nạp đúng phạm vi):**
   - `packages/server/AGENTS.md`: quy tắc viết stack, runner, `bridge-proxy` (cookie/CSP/304/error wrapper) và yêu cầu kiểm thử trên dự án thật/E2E.
   - `packages/studio/AGENTS.md`: quy tắc đồng bộ i18n (`en` & `vi` để pass `pnpm check:i18n`), quy tắc giao tiếp Bridge và QC-40.

### Giai đoạn 2: Tạo Skill kiểm chứng nội bộ (`.agents/skills/kumicraft-verify/SKILL.md`)

- Định nghĩa rõ bảng ánh xạ **Vùng code thay đổi → Lệnh kiểm chứng bắt buộc**:
  - Sửa logic thuần trong `packages/server` / `packages/shared` / `packages/content`: `vitest` (file liên quan) + `tsc --noEmit` + `eslint` + `pnpm lint:deps`.
  - Sửa `packages/studio`: thêm `pnpm check:i18n` nếu đụng chuỗi/locale.
  - Sửa `runners`, `stacks`, `bridge-proxy`, `packages/bridge`, hoặc luồng UI Canvas/Editor: bắt buộc thêm `pnpm build` (cập nhật `packages/cli/dist`) + chạy Playwright E2E tương ứng (`npx playwright test e2e/<file>.e2e.ts --workers=1`).
  - Thêm tính năng hoặc stack mới chưa có E2E: đề xuất viết bổ sung test E2E/tour thật.

### Giai đoạn 3: Dọn dẹp `/context`, cấu hình Allowlist và cài đặt `hooks.json` nhẹ

1. Mở `/context`, tắt các plugin/MCP không liên quan khi làm việc trên KumiCraft.
2. Thêm nhóm lệnh verify an toàn vào **Project-Level Command Allowlist** của KumiCraft trong Antigravity 2.0.
3. Tạo `.agents/hooks.json` (event `Stop`) gọi script nhỏ kiểm tra `pnpm lint:deps` và `pnpm check:i18n` chỉ khi working tree có file `.ts`/`.tsx`/`.json` liên quan vừa thay đổi.

### Giai đoạn 4: Quy chuẩn làm việc hằng ngày

- **Task lớn / chạm ≥ 3 file / đụng kiến trúc:** dùng model mạnh + `/plan` → duyệt 1 lần (Scope Gate) → AI tự thực thi + verify tới khi pass E2E → gọi `/learn` (nếu vừa xử lý edge-case mới) → gọi `/compact`.
- **Task nhỏ (commit, hỏi log, sửa text/CSS nhỏ):** chuyển model nhẹ, xử lý gọn trong 1 lượt.
- **Trước khi commit:** luôn dùng đúng chuẩn `commitlint` (`feat(server): ...`, `fix(studio): ...`) và kiểm tra `git status` để tránh đưa file tạm (như `.kumicraft/lock`) vào stage.

---

## 4. Các Tính Năng 2026 Không Áp Dụng Cho KumiCraft

Để tránh phức tạp hóa cấu hình và tốn quota không cần thiết, chủ động **bỏ qua**:

- **`/teamwork`:** Quá hao quota trên gói Pro cho một monorepo 1 người dev chính.
- **`/grill-me` mặc định cho câu hỏi kỹ thuật:** Dễ gây quá tải quyết định kiến trúc cho người dùng.
- **Background Sidecars (`sidecars/`) & Scheduled Tasks (`/schedule`):** Phù hợp vận hành/giám sát server 24/7, không trực tiếp cải thiện chất lượng code từng phiên.
- **Đóng gói Plugin (`plugin.json`) & `/run-workflow`:** Chỉ cần khi phân phối cấu hình cho nhiều repository hoặc fan-out hàng chục module độc lập; riêng KumiCraft dùng trực tiếp `AGENTS.md` + `.agents/` là đủ gọn và dễ bảo trì.
