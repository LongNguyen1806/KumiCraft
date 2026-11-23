# Hướng Dẫn Tối Ưu Hệ Sinh Thái Google & Antigravity Cho Ứng Dụng Thương Mại

---

## Phần 1: Tối Ưu Hóa Quy Trình Xây Dựng Ứng Dụng Thương Mại Bằng Gemini & Antigravity

### 1. Câu hỏi (User)

> Tôi muốn biết chính xác cách build 1 ứng dụng có thể thương mại trên bằng Gemini. Hiện tại theo tôi biết Google có nhiều nền tảng hơn Claude để build app. Nhưng tôi chỉ đang build theo dạng cổ điển: viết SRS, thiết kế kiến trúc app bằng text và build bằng Antigravity CLI chia làm nhiều bước nhỏ để làm cho chuẩn. Nói chung làm đủ các bước nhưng kết quả cho ra không bằng Claude Code, dù có xài gói Max với model mạnh nhất của Gemini, vẫn không tốt bằng Opus 5.5. Tôi biết không phải vấn đề nằm ở model suy luận kém hơn, có thể tôi chưa tận dụng đúng hoặc chưa biết cách xài hệ sinh thái build app của Google.

### 2. Phân tích & Hướng dẫn (Gemini)

Nguyên nhân khiến kết quả chưa đạt kỳ vọng nằm ở sự khác biệt về triết lý kiến trúc (**Harness Engineering**) của hai hệ sinh thái:

- **Claude Code:** Tối ưu cho luồng làm việc tuần tự, hội thoại sâu và suy luận tuyến tính trong một phiên duy nhất.
- **Hệ sinh thái Google (Antigravity 2.0 / CLI + Gemini):** Được thiết kế xoay quanh **Context Engineering**, **Đa tác tử bất đồng bộ (Parallel Subagents)** và **Kiểm chứng tự động (Artifacts + Hooks)**.

Nếu chỉ dùng Antigravity CLI như một công cụ gõ lệnh từng bước theo SRS tĩnh, bạn đang bỏ qua phần lớn sức mạnh cốt lõi của hệ thống này. Dưới đây là quy trình chuẩn để xây dựng một ứng dụng thương mại hoàn chỉnh trên nền tảng của Google:

#### 1. Chuyển từ "Viết SRS rời rạc" sang Context Contract (`AGENTS.md` + Rules)

Thay vì ném một file SRS dài vào đầu mỗi phiên chat (dễ gây loãng context hoặc trôi quy ước khi chia nhỏ bước), hãy thiết lập bộ khung ngữ cảnh cố định tại thư mục gốc dự án:

- **`AGENTS.md` (ở root dự án) & `~/.gemini/GEMINI.md` (global):** Đây là bản hiến pháp của dự án mà Antigravity đọc ngay khi khởi tạo phiên. Ghi rõ vào đây: Tech stack bắt buộc, quy chuẩn đặt tên, cấu trúc thư mục, quy tắc xử lý lỗi, và các ràng buộc bảo mật.
- **Modular Rules (`.agents/rules/`):** Tách nhỏ các quy chuẩn theo từng mảng (ví dụ: `database-schema.md`, `api-design.md`, `ui-standards.md`). Agent sẽ tự động nạp đúng file luật khi chạm tới thư mục tương ứng, giúp tiết kiệm context window và giữ độ chính xác cao.

#### 2. Dùng `/grill-me` và `/plan` thay vì tự viết kiến trúc thủ công

Model Gemini rất mạnh ở khả năng phản biện logic nếu được kích hoạt đúng chế độ:

- Khởi chạy lệnh `/grill-me` kèm ý tưởng ứng dụng thương mại của bạn. Agent sẽ đóng vai trò kiến trúc sư trưởng, đặt các câu hỏi phản biện ngược lại bạn (về edge-case, luồng thanh toán, phân quyền, chịu tải, schema database) để lấp đầy các lỗ hổng logic trước khi viết bất kỳ dòng code nào.
- Chuyển sang `/plan` (hoặc bật chế độ `/boost` để ép model dùng mức suy luận sâu nhất) nhằm xuất ra bản kế hoạch triển khai dạng Artifacts (Implementation Plan & Task List) có thể review và chỉnh sửa trực tiếp.

#### 3. Khai thác Parallel Subagents + Git Worktree (Điểm mạnh cốt lõi của Antigravity)

Sai lầm phổ biến nhất khi dùng Antigravity CLI là bắt 1 agent chính làm tuần tự từ A đến Z. Khi codebase phình to, agent chính bị "cháy" context vì phải đọc quá nhiều file.

- **Cơ chế hoạt động:** Khi giao các module độc lập (ví dụ: Xây dựng API Backend, Thiết kế UI Frontend, Viết bộ Unit Test), hãy dùng lệnh `/teamwork` hoặc `/swarm` (hoặc yêu cầu agent gọi `invoke_subagent`).
- **Sức mạnh cô lập:** Antigravity tự động tạo một nhánh Git Worktree riêng biệt cho mỗi subagent. Các subagent chạy song song trên các không gian file độc lập hoàn toàn mà không ghi đè code của nhau, sau đó agent chính mới tiến hành merge và giải quyết xung đột.

#### 4. Đóng gói Skills và cài đặt Lifecycle Hooks (Chặn lỗi ngay từ đầu)

Để app đạt chuẩn thương mại (không lỗi vặt, không hỏng build, đúng format), không thể chỉ dựa vào lời nhắc trong prompt. Bạn phải dùng cơ chế cưỡng chế kỹ thuật:

- **Agent Skills (`.agents/skills/<tên-skill>/SKILL.md`):** Biến các quy trình lặp đi lặp lại thành lệnh slash tùy chỉnh (ví dụ: `/create-endpoint`, `/audit-security`, `/db-migration`). Trong file `SKILL.md`, bạn đính kèm sẵn script mẫu và checklist kiểm tra để agent tuân thủ 100%.
- **Lifecycle Hooks (`.agents/hooks.json`):** Thiết lập các hook chạy tự động tại sự kiện `PostToolUse` (ngay sau khi agent sửa/tạo file):
  - Tự động chạy linter / formatter (`eslint`, `prettier`, `black`...).
  - Tự động chạy compiler/type-check (`tsc --noEmit` hoặc `npm run build`). Nếu có lỗi cú pháp hay thiếu import, hook trả lỗi thẳng về cho agent tự sửa ngay lập tức trước khi báo cáo hoàn thành với bạn.

#### 5. Kết hợp Antigravity 2.0 (GUI) để nghiệm thu trực quan và đóng gói hạ tầng Google

Antigravity CLI và Antigravity 2.0 dùng chung một nhân xử lý (Agent Harness) và đồng bộ cấu hình. Quy trình kết hợp thực tế:

- **Code & Refactor nặng ở CLI (`agy`):** Tốc độ nhanh, nhẹ, dễ điều phối subagent và theo dõi log tool call chi tiết.
- **Nghiệm thu UI/UX bằng Antigravity 2.0 Browser Agent:** Chuyển phiên làm việc sang giao diện Antigravity 2.0 (dùng `@conversation` để kéo phiên từ CLI sang). Kích hoạt tính năng Browser Use, agent sẽ tự mở trình duyệt tích hợp, bấm thử các nút, điền form, kiểm tra responsive và quay lại Browser Recording (Artifact) chứng minh tính năng chạy thật.
- **Kết nối hệ sinh thái Google Cloud qua MCP & Firebase/Cloud Run:** Gắn các MCP Server (như Firebase MCP, Google Cloud MCP, Postgres/Supabase MCP) trực tiếp vào Antigravity để agent tự khởi tạo Authentication, cấu hình Firestore/Cloud SQL, và deploy trực tiếp lên Cloud Run hoặc Firebase App Hosting mà không cần copy-paste cấu hình thủ công.

#### Tóm tắt lộ trình áp dụng:

1. Tạo file `AGENTS.md` định nghĩa kiến trúc, tech stack và quy tắc code chuẩn.
2. Cấu hình `.agents/hooks.json` để ép chạy test/build tự động mỗi khi agent sửa file.
3. Chạy `agy`, gõ `/grill-me` để chốt thiết kế chi tiết, sau đó dùng `/plan` để chia việc.
4. Dùng `/teamwork` để đẩy các module độc lập cho các subagent chạy song song trên các Git worktree riêng.
5. Dùng Browser Agent của Antigravity 2.0 để test end-to-end giao diện và deploy qua MCP.

---

## Phần 2: Phương Pháp Đưa Gói Google AI Pro Ngang Tầm Claude Code Opus 5.5

### 1. Câu hỏi (User)

> Tôi hạ gói Max xuống gói Pro rồi do thấy giá cũng ngang với Claude nhưng lại không chất lượng bằng. Có cách nào biến Gemini Antigravity làm tốt như Claude Code Opus 5.5 không? Như phân tích của bạn ở trên thì đa phần là do cấu hình chưa tốt, không phải do model.

### 2. Phân tích & Hướng dẫn (Gemini)

Gói Google AI Pro hỗ trợ đầy đủ toàn bộ cơ chế cốt lõi của Antigravity (bao gồm `/teamwork`, `/boost`, `/swarm`, Hooks, Rules, Skills và Browser Agent) — chỉ thấp hơn gói Ultra/Max ở hạn mức request (quota) và tín dụng Google Cloud hàng tháng.

Để Antigravity trên gói Pro đạt độ chặt chẽ, tự kiểm lỗi và giữ vững kiến trúc như Claude Code, cần chuyển từ cách "chat chia bước thủ công" sang cấu hình 4 lớp cưỡng chế kỹ thuật:

### 1. Thiết lập bộ "Hiến pháp" `AGENTS.md` và Modular Rules

Claude Code tự động duy trì tư duy phòng thủ xuyên suốt phiên làm việc, còn Antigravity tuân thủ tuyệt đối các file luật được nạp tự động trong workspace.

Tạo file `AGENTS.md` tại thư mục gốc dự án (file này không cần YAML frontmatter và luôn ở trạng thái kích hoạt `always_on`). Đưa vào đây các ràng buộc cứng:

```markdown
# Project Engineering Standards

- **Architecture:** Tuân thủ nghiêm ngặt cấu trúc thư mục hiện tại. Không tạo file mới ngoài kiến trúc đã duyệt.
- **Code Completeness:** Cấm viết code giữ chỗ (`TODO`, `placeholder`, mock data giả lập logic). Phải xử lý đầy đủ error handling, validation đầu vào và các trường hợp biên (edge cases).
- **Verification:** Trước khi báo cáo hoàn thành bất kỳ tác vụ nào, bắt buộc chạy lệnh kiểm tra kiểu dữ liệu (type-check), linter và test liên quan. Nếu có lỗi, tự sửa cho đến khi pass 100%.
```

- **Tách luật theo từng module vào `.agents/rules/*.md`:** Với các quy chuẩn chi tiết (ví dụ: schema database, chuẩn API, quy tắc UI), tách thành từng file nhỏ kèm YAML frontmatter khai báo trigger. Agent sẽ chỉ nạp đúng file luật khi chỉnh sửa thư mục tương ứng, giúp tiết kiệm context window và giữ quota gói Pro hiệu quả.
- **Tránh xung đột cấu hình toàn cục:** Nếu máy cài cả Antigravity và Gemini CLI, hãy đặt luật dùng chung cho mọi dự án tại `~/.gemini/config/AGENTS.md` thay vì `~/.gemini/GEMINI.md` để hai công cụ không ghi đè cấu hình của nhau.

### 2. Cài đặt PostToolUse Hooks (`.agents/hooks.json`)

Điểm khiến Claude Code vượt trội khi dùng mặc định là thói quen tự chạy terminal kiểm tra ngay sau khi sửa code. Trên Antigravity, cơ chế này được thực hiện thông qua Hooks.

Tạo file `.agents/hooks.json` tại thư mục gốc dự án để chặn ngay sau mọi thao tác ghi/sửa file của agent (`write_to_file`, `replace_file_content`, `multi_replace_file_content`) và tự động chạy trình kiểm tra:

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "write_to_file|replace_file_content|multi_replace_file_content",
        "hooks": [
          {
            "type": "command",
            "command": "npm run typecheck && npm run lint"
          }
        ]
      }
    ]
  }
}
```

_(Thay `npm run typecheck && npm run lint` bằng lệnh kiểm tra tương ứng của stack dự án, ví dụ `npx tsc --noEmit`, `pytest`, hoặc `dotnet build`)._

Khi hook trả về mã lỗi, Antigravity sẽ nhận trực tiếp log lỗi đó và tự động sửa lại code trước khi dừng lượt chạy.

### 3. Dùng đúng quy trình khóa Plan trước khi Code (Shift + Tab)

Thay vì tự viết SRS rồi ném từng đoạn nhỏ cho agent làm, hãy để Antigravity tự lập kế hoạch trên toàn bộ ngữ cảnh codebase và khóa kế hoạch đó lại:

1. **Bật chế độ plan:** Trong Antigravity CLI (`agy`), nhấn `Shift + Tab` cho đến khi thanh trạng thái hiện `[plan]` (hoặc gõ `/plan` đầu câu lệnh).
2. **Khóa cổng duyệt (Review Gate):** Đảm bảo cài đặt `artifactReviewPolicy` ở mức `asks-for-review` (hoặc _Review every plan_ trong Settings của Antigravity IDE). Agent sẽ xuất ra Implementation Plan (Artifact) và bắt buộc dừng lại chờ bạn duyệt. Có thể sửa trực tiếp trên file plan này nếu thấy thiếu sót.
3. **Chuyển sang auto để thực thi:** Sau khi duyệt plan, nhấn `Shift + Tab` chuyển sang chế độ `auto`. Agent sẽ tự động tạo/sửa file trong workspace và chạy các lệnh terminal an toàn trong sandbox mà không ngắt quãng hỏi từng bước.

### 4. Thay thế việc chia bước thủ công bằng `/teamwork` và `/boost`

Khi làm các tính năng lớn, việc tự chia nhỏ thành nhiều prompt rời rạc làm agent mất liên kết giữa các module. Cần dùng bộ điều phối đa tác tử tích hợp sẵn:

- **Dùng `/teamwork <mô tả tính năng>` cho các module lớn (Auth, Thanh toán, Luồng nghiệp vụ chính):**
  - **Pha 1 (Scoping Interview):** Agent chủ động hỏi làm rõ yêu cầu và mức độ kiểm định (Integrity Mode), sau đó xuất ra Prompt Artifact chuẩn hóa.
  - **Pha 2 (Autonomous Execution):** Sau khi xác nhận, hệ thống tự động phân rã việc cho các subagent chuyên biệt chạy song song trên các Git worktree cô lập, đi kèm Adversarial Verification Gates (cổng kiểm định đối kháng — agent khác phản biện và test lại code của worker).
- **Dùng `/boost <mô tả vấn đề>` cho các lỗi khó hoặc thuật toán phức tạp:** Vòng lặp đa tác tử chuyên sâu (implement → phản biện tìm lỗ hổng → sửa → kiểm chứng lại) chạy cho đến khi giải quyết triệt để vấn đề.

### Mẹo phân bổ Quota tối ưu trên gói Google AI Pro

- **Không dùng `/teamwork` hay `/boost` cho tác vụ nhỏ:** Với các việc như sửa CSS, đổi text, thêm field đơn giản, hãy chuyển CLI về chế độ `accept-edits` (hoặc chế độ Fast trên IDE) để xử lý trong 1 lượt, giữ lại quota cho các module lõi.
- **Nghiệm thu UI bằng Browser Agent:** Sau khi backend và frontend chạy xong, chuyển phiên làm việc sang giao diện Antigravity IDE và yêu cầu agent mở trình duyệt tích hợp tự bấm thử luồng người dùng thật (đăng ký, tạo dữ liệu, thanh toán thử) thay vì chỉ đọc code tĩnh.
