# Phase 2 — Lượt 15: CLI hoàn chỉnh, gói cài và dọn nợ trước cổng G2 (WP-2.07)

Đọc `README.md` cùng thư mục trước, nhất là mục **"Lỗi lint hay vấp"**, rồi làm đúng bản này. Quy tắc: R-CL-01 đến R-CL-04, S-96; nợ ghi ở `p2-ke-hoach.md` ("Việc để sau", 2026-10-19).

Đây là lượt code cuối của Phase 2.

- **Gemini** làm ba phần A, B, C dưới đây.
- **Claude** làm cổng G2 sau đó: chuyển trace sang Phase 2, E2E hồi quy, rà spec.
- **Chủ dự án** kiểm tay G2 (`p2-ke-hoach.md` mục 5).

Lượt này **không sửa Bridge**.

Phần CLI phần lớn đã có từ Phase 1:

- `packages/cli/src/args.ts`: tham số, `--help`, `--version`, mã thoát 2;
- `scripts/smoke-installed.mjs`;
- script `pnpm package`.

Chỉ làm phần còn thiếu dưới đây.

## 1. Mục tiêu (người dùng thấy gì)

1. **Ctrl+C** khi KumiCraft đang chạy:
   - dev server của dự án dừng; việc cài thư viện đang chạy bị hủy;
   - tab Studio đang mở hiện ngay "KumiCraft đã dừng" (không đợi mất kết nối);
   - lệnh thoát trong tối đa 10 giây.
   - Bấm Ctrl+C lần hai thì thoát ngay.
2. `pnpm package` tạo file `.tgz`. Có lệnh kiểm tra tự động: trong gói có đủ Studio, Bridge, template, không có `postinstall`.
3. Dữ liệu server trả về Studio đều được kiểm bằng schema. Server trả sai dạng → Studio báo lỗi rõ thay vì hỏng ngầm.

## 2. Đọc trước (CW-52)

| File                                                                                                                                              | Lý do                                                  |
| ------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| `docs/spec.md` R-CL-01 đến R-CL-04, R-RN-07, S-96, mục sự kiện (`server.*`)                                                                       | Quy tắc                                                |
| `packages/cli/src/index.ts` (`stop`), `args.ts`                                                                                                   | Tắt hiện tại: chỉ `server.close()` rồi `exit(0)`       |
| `packages/server/src/index.ts` (`startServer` → `close`)                                                                                          | Thứ tự dừng hiện tại: runner → project → history → app |
| `packages/server/src/core/jobs/job-service.ts`                                                                                                    | Việc cài đặt chạy nền, cần hủy khi tắt                 |
| `packages/shared/src/` (schema sự kiện `StudioServerEvent`), `packages/studio/src/api/events-client.ts`, chỗ hiện `connection-lost`               | Thêm sự kiện `server.shuttingDown`, Studio hiện ngay   |
| `packages/studio/src/api/*.ts` (`http.ts`, `project-client.ts`, `runner-client.ts`, `settings-client.ts`, `source-client.ts`, `events-client.ts`) | 17 chỗ `as <Kiểu>` với dữ liệu từ server               |
| `scripts/smoke-installed.mjs`, `package.json` (script `package`), `packages/cli/package.json`, `packages/cli/tsdown.config.ts`                    | Gói cài                                                |

## 3. Hợp đồng

### 3.1. Phần A — Tắt an toàn (R-CL-02)

**Shared:** thêm sự kiện `server.shuttingDown` (payload `{}`) vào schema sự kiện server → Studio, cùng cách các sự kiện `project.*` đang khai báo.

**Server** — `RunningServer.close()` theo thứ tự:

1. Phát `server.shuttingDown` qua `eventBus`, rồi chờ tối đa 200 ms cho sự kiện kịp gửi qua WebSocket.
2. Hủy mọi job đang chạy của `job-service` (cài thư viện): giết tiến trình con, job chuyển sang trạng thái hủy.
   - Có sẵn hàm hủy thì dùng; chưa có thì thêm `cancelAll()`.
3. `runnerService.dispose()` (dừng dev server, R-RN-07).
4. `projectService.close()` (nhả khóa), `historyService.clear()`, `app.close()`.

`close()` gọi hai lần thì lần hai chờ chung lần một (không chạy lại).

**CLI** `index.ts`:

- `SIGINT`/`SIGTERM` lần đầu: in `Stopping KumiCraft…`, gọi `server.close()`. Song song đặt hẹn giờ 10 giây: hết giờ thì in cảnh báo và `process.exit(1)`. Đóng xong thì `exit(0)`.
- Tín hiệu lần hai trong lúc đang dừng: in `Forced stop.` và `process.exit(1)` ngay.
- Đưa logic này vào hàm thuần có thể test, ví dụ `createShutdown({ close, exit, log, setTimer })` trong `packages/cli/src/shutdown.ts`; `index.ts` chỉ nối.

**Studio:** nhận `server.shuttingDown` → hiện ngay trạng thái mất kết nối có sẵn (`connection-lost`), câu "KumiCraft đã dừng" (`vi`) / "KumiCraft has stopped" (`en`). Khi server chạy lại, cơ chế kết nối lại hiện có (S-05a) vẫn hoạt động.

### 3.2. Phần B — Gói cài (R-CL-03)

- `scripts/check-package.mjs` (mới): đọc danh sách file trong tarball mới nhất ở `artifacts/`, hoặc dùng `npm pack --dry-run --json` trong `packages/cli`. Kiểm:
  - có `package.json` không có `scripts.postinstall`, `preinstall`, `install`;
  - có file chạy của `bin`;
  - có thư mục Studio đã build (có `index.html`);
  - có bundle Bridge, hoặc bundle server có chứa `BRIDGE_CLIENT_CODE`;
  - có template dự án mới (Oakline);
  - không có `node_modules`, `*.test.*`, `src/` của TypeScript, `.map` lớn hơn 1 MB.

  Thiếu thì in rõ từng mục và thoát 1. Đủ thì in tổng số file và dung lượng, thoát 0.

- Nếu kiểm tra phát hiện gói **thiếu** Studio, Bridge hoặc template: sửa cấu hình build/pack (`tsdown.config.ts`, trường `files`, bước chép) cho đủ. Ghi rõ đã sửa gì.
- Thêm script gốc `"check:package": "node scripts/check-package.mjs"`. **Không** đưa vào `pnpm verify`, vì phải build gói, chậm.
- `README.md` gốc (hoặc `packages/cli/README.md`): mục ngắn "Cài thử bản đóng gói": `pnpm package` → `pnpm check:package` → `npm install -g artifacts/<file>.tgz` → `node scripts/smoke-installed.mjs`.

### 3.3. Phần C — Dữ liệu server được kiểm bằng schema (nợ 2026-10-19)

- Mọi hàm trong `packages/studio/src/api/*.ts` trả dữ liệu từ server phải `XxxSchema.parse(...)` (hoặc `safeParse` → ném lỗi có mã E016 `invalidResponse`). Không còn `as <Kiểu>` trên dữ liệu server.
  - Liệt kê bằng `grep -n "\bas [A-Z]" packages/studio/src/api/*.ts` (hiện 17 chỗ).
  - `as const` và ép kiểu không đụng dữ liệu server thì giữ.
- Thiếu schema trong shared thì thêm (đặt cạnh kiểu tương ứng, export qua `index.ts`). **Không đổi** dạng dữ liệu server đang trả.
- `http.ts`: hàm nền có thể nhận schema (`apiGet(path, schema)`), hoặc để từng client tự parse. Chọn một cách và dùng thống nhất.
- Test cũ của Studio đang mock fetch bằng dữ liệu thiếu trường sẽ hỏng. Sửa **dữ liệu giả** cho đúng schema. **Không** nới schema và **không** đổi assertion. Ghi số test đã sửa dữ liệu giả vào báo cáo.

## 4. Tình huống test

| #   | Đầu vào                                                                                                          | Kết quả                                                                                         | Mã      |
| --- | ---------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | ------- |
| 1   | `createShutdown`: tín hiệu một lần, `close` xong sau 50 ms                                                       | in `Stopping KumiCraft…`; `exit(0)` đúng một lần; hẹn giờ 10 s bị hủy                           | R-CL-02 |
| 2   | `close` không bao giờ xong; tiến thời gian 10 s (fake timers)                                                    | `exit(1)` đúng một lần, có cảnh báo                                                             | R-CL-02 |
| 3   | Tín hiệu lần hai khi đang dừng                                                                                   | in `Forced stop.`; `exit(1)` ngay; `close` chỉ được gọi một lần                                 | R-CL-02 |
| 4   | `RunningServer.close()` với eventBus giả, job giả đang chạy, runner giả                                          | thứ tự: phát `server.shuttingDown` → hủy job → `runner.dispose` → `project.close` → `app.close` | R-CL-02 |
| 5   | Gọi `close()` hai lần cùng lúc                                                                                   | `runner.dispose` chỉ chạy một lần; cả hai promise xong                                          | R-CL-02 |
| 6   | `job-service.cancelAll()` khi có một job cài đang chạy (tiến trình giả)                                          | tiến trình bị giết; job ở trạng thái hủy; job mới sau đó vẫn chạy được                          | R-CL-02 |
| 7   | Studio nhận sự kiện `server.shuttingDown`                                                                        | `connection-lost` hiện ngay với câu "KumiCraft đã dừng" / "KumiCraft has stopped"               | R-CL-02 |
| 8   | `check-package` trên danh sách file giả: đủ; thiếu Studio `index.html`; có `postinstall`; có `node_modules/x.js` | thoát 0; thoát 1 kèm tên mục thiếu; thoát 1; thoát 1 (tách phần kiểm thành hàm thuần để test)   | R-CL-03 |
| 9   | Mỗi client trong `api/`: một test trả dữ liệu đúng (được parse) và một test trả dữ liệu thiếu trường bắt buộc    | đúng: trả đối tượng đã parse; sai: ném lỗi E016 `invalidResponse` (không trả dữ liệu hỏng)      | V-80    |
| 10  | `grep -n "\bas [A-Z]" packages/studio/src/api/*.ts` (trừ `as const`)                                             | không còn dòng nào (ghi kết quả lệnh vào báo cáo)                                               | —       |

## 4b. Việc của Claude ở cổng G2 (không phải của Gemini)

- Chuyển trace sang Phase 2 (`currentPhase` trong `scripts/trace-scope.json`), rồi bổ sung test cho mã nào thiếu.
- Chạy E2E hồi quy, rà spec-log #26 đến #33.

## 5. Kiểm tay (chủ dự án, sau lượt này)

1. `pnpm package` rồi `pnpm check:package`: in "OK" kèm số file.
2. `npm install -g artifacts/<file>.tgz` trong thư mục trống, `kumicraft`: Studio mở, tạo dự án mới tới Canvas.
3. Đang cài thư viện thì Ctrl+C: lệnh thoát trong vài giây, không còn tiến trình `node` nào của dự án chạy (Task Manager); tab Studio hiện "KumiCraft đã dừng".
4. Chạy lại `kumicraft`: tab Studio cũ tự kết nối lại.

## 6. Bẫy đã biết

- **Không sửa Bridge, không đổi dạng dữ liệu API.**
- **Không nới schema cho test qua**: test cũ hỏng vì dữ liệu giả thiếu trường thì sửa dữ liệu giả.
- **Windows**: giết tiến trình con phải giết cả cây (dùng cách `node-process.ts` đang dùng), không chỉ tiến trình cha.
- **Sự kiện trước khi đóng**: phải phát `server.shuttingDown` **trước** khi đóng WebSocket, nếu không Studio không nhận được.
- `check-package.mjs` chạy được trên Windows (đường dẫn `\`), dùng `node:` API, không cần `tar` ngoài.
- **Viết đúng lint ngay từ đầu**, `pnpm exec eslint <file>` sau mỗi file. File ≤ 400 dòng, hàm ≤ 50 dòng.

## 7. Báo cáo và commit

Theo mẫu `README.md`. Ghi rõ:

- kết quả `pnpm package` + `pnpm check:package`;
- danh sách file `api/` đã đổi sang parse;
- số test đã sửa dữ liệu giả.

Lượt này đụng phiên (tắt server, kết nối lại) nên **chạy `pnpm test:e2e` một lần** sau `pnpm verify`.

```text
feat(cli): stop safely, check the package and validate api data
```
