# Phase 1, lượt 4: gắn tag, viết test còn thiếu, dự án mẫu Vite 7 (VG-15)

Bản này được viết sau khi Claude đã **chạy thử từng hành vi trên code thật**. Mọi "kết quả mong đợi" dưới đây là giá trị code hiện tại trả về và khớp spec. Vì vậy:

- Test viết đúng mô tả **phải xanh ngay**. Nếu một test đỏ: kiểm lại test của mình trước (đường dẫn, dữ liệu, tên `data-testid`). Đỏ vì code trả khác mô tả thì **dừng, báo nguyên văn**, không sửa code tính năng, không đổi kết quả mong đợi.
- **Không sửa code tính năng** trong `packages/*/src` (trừ file `*.test.ts(x)` và trừ phần C ghi rõ). Không đổi `eslint.config.js`, `scripts/trace-scope.json`.
- Mỗi test phải **đỏ nếu bỏ phần code nó kiểm**. Cấm test chỉ kiểm hằng số, biến của chính test, `typeof`, hay mock tự trả về điều mình kiểm.
- Không `null` (trừ `toBeNull()` cho API DOM `querySelector`, `queryByTestId`), không `any`, không `as unknown as`, không `eslint-disable`, không `waitForTimeout`.
- Tag là danh sách mã trong **một cặp ngoặc vuông, chỉ có mã**: `[R-IN-10]`, `[R-TW-04, R-TW-05]`. Không viết `[SPEC-04 R-IN-18]`, `[R-RN-06, Test 1]`, `R-TX-02:`.
- Làm theo thứ tự **A → B → C**. Phần nào kẹt thì dừng ở đó và báo.
- Cuối lượt: `pnpm format`, rồi `pnpm verify` (thoát mã 0, 0 cảnh báo), `pnpm test:e2e`, `pnpm test:e2e:network`. Dán nguyên văn dòng tổng.

**Claude đã tự sửa trước** (đã có test, không làm lại): R-SE-09 (`detectIndentation` luôn trả bậc 2; nay lấy bậc nhỏ nhất của file, test `source-editor/ast-helpers.test.ts`), S-26 (`sendError` ghi log `warn` khi E012, test `adapters/http/send-error.test.ts`). `scripts/vg/vg-16.mjs` đã chạy đạt (40/40 file, P95 29 ms ≤ 100 ms) nên R-SE-16 không cần cache.

Kiểm tiến độ bằng: sửa tạm `scripts/trace-scope.json` `"currentPhase": 1`, chạy `pnpm trace`, **trả lại `0`** trước khi báo xong. Sau lượt này chỉ được còn thiếu 7 mã: R-FW-05, R-QA-01, R-IN-19, R-IN-21, R-PJ-24, R-SE-16, R-SL-12 (S-86 cũng còn, nếu chưa làm mục B-S86 ở dưới).

---

## Phần A: chỉ sửa tên test (không đổi nội dung test)

| File                                                                                | Tên hiện tại (đầu dòng)                                                                                                                                                                | Đổi thành                                                                                   |
| ----------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `packages/shared/src/tailwind/tokenizer.test.ts`                                    | `describe('M-TW Tokenizer [SPEC-04 section 8, R-TW-01, R-TW-02]'`                                                                                                                      | `describe('M-TW Tokenizer [R-TW-01, R-TW-02]'`                                              |
| `packages/shared/src/tailwind/model.test.ts`                                        | `it('Scenario 3: R-TW-09 disambiguation …'`                                                                                                                                            | thêm cuối tên ` [R-TW-09]`                                                                  |
| như trên                                                                            | `it('Scenario 4: readValue p-4 max-md:p-2 …'` và `it('Scenario 5: …'`                                                                                                                  | thêm ` [R-TW-04]`                                                                           |
| như trên                                                                            | `it('Scenario 7: p-4 pt-2 reads …'` và `it('Scenario 12: writeValue all deletes …'`                                                                                                    | thêm ` [R-TW-07]`                                                                           |
| như trên                                                                            | `it('Scenario 9: writeValue replaces in-place …'`, `it('Scenario 10: …'`, `it('Scenario 11: …'`                                                                                        | thêm ` [R-TW-05]`                                                                           |
| như trên                                                                            | `it('Scenario 13: pxToSpacing …'`                                                                                                                                                      | thêm ` [R-TW-08]`                                                                           |
| như trên                                                                            | `it('Scenario 14: preserves arbitrary whitespace …'`                                                                                                                                   | thêm ` [R-TW-06]`                                                                           |
| như trên                                                                            | `it('Scenario 15: roundtrip R-TW-11 …'`                                                                                                                                                | thêm ` [R-TW-11]`                                                                           |
| `packages/bridge/src/client/text-edit.test.ts`                                      | `it('R-TX-02: sets contenteditable and focuses when started'`                                                                                                                          | `it('sets contenteditable and focuses when started [R-TX-02]'`                              |
| như trên                                                                            | `it('R-TX-08 & Scenario 7: does not commit on Enter when IME …'`                                                                                                                       | `it('Scenario 7: does not commit on Enter when IME is composing Vietnamese text [R-TX-08]'` |
| `packages/studio/src/features/inspector/use-live-edit.test.ts`                      | `describe('useLiveEdit [SPEC-04 R-IN-13, R-IN-14, R-IN-20]'`                                                                                                                           | `describe('useLiveEdit [R-IN-13, R-IN-14, R-IN-20]'`                                        |
| `packages/studio/src/features/inspector/use-attribute-edit.test.ts`                 | `describe('useAttributeEdit [SPEC-04 R-IN-18]'`                                                                                                                                        | `describe('useAttributeEdit [R-IN-18]'`                                                     |
| `packages/studio/src/features/inspector/components/tag-attributes-section.test.tsx` | `describe('TagAttributesSection [SPEC-04 R-IN-18]'`                                                                                                                                    | `describe('TagAttributesSection [R-IN-18]'`                                                 |
| `packages/studio/src/features/inspector/inspector-panel.test.tsx`                   | `it('Scenario 7: renders "Selected 2 elements" …'`                                                                                                                                     | thêm ` [R-IN-10]`                                                                           |
| như trên                                                                            | `it('Scenario 1: renders all groups and matching values …'`                                                                                                                            | thêm ` [R-IN-10]`                                                                           |
| như trên                                                                            | `it('Scenario 2: Mobile frame desktop-first with p-6 …'`                                                                                                                               | thêm ` [R-IN-11]`                                                                           |
| như trên                                                                            | `it('Scenario 5: locks all inputs when className is expression …'`                                                                                                                     | thêm ` [R-IN-15]`                                                                           |
| như trên                                                                            | `it('Scenario 6: displays warning banners when component.usages > 1 …'`                                                                                                                | thêm ` [R-IN-16]`                                                                           |
| `packages/studio/src/features/editor/canvas-area.test.tsx`                          | 6 test `renders untrusted prompt…`, `renders needs-install prompt…`, `renders stopped view…`, `renders loading spinner…`, `renders iframe when runner is ready`, `renders error view…` | thêm ` [R-RN-20]` vào từng tên                                                              |
| `packages/bridge/src/client/bridge-client-runtime.test.ts`                          | `it('leaves Ctrl+Z to the text instead of sending Undo to the Studio'`                                                                                                                 | giữ tên (đã thuộc `describe … [R-TX-03]`); **không** gắn R-BR-18 ở đây                      |
| `packages/studio/src/features/selection/bridge-channel.test.ts`                     | `it('sends messages with correct envelope and target origin [V-110]'`                                                                                                                  | `[V-110, S-101]`                                                                            |
| như trên                                                                            | `it('ignores messages with wrong source, origin, or nonce [V-111]'`                                                                                                                    | `[V-111, R-BR-30]`                                                                          |
| `packages/bridge/src/integrations/vite.test.ts`                                     | `it('configures plugin metadata for dev server only [R-BR-04]'`                                                                                                                        | `[R-BR-04, S-103]`                                                                          |
| `packages/server/src/runners/vite-react.test.ts`                                    | `describe('vite-react runner'`                                                                                                                                                         | `describe('vite-react runner [R-RN-03]'`                                                    |
| `packages/server/src/core/project/project-lifecycle.test.ts`                        | `it('opens untrusted at first, locks the project and runs nothing [S-80, S-81]'`                                                                                                       | `[S-80, S-81, R-PJ-15]`                                                                     |
| `packages/server/src/core/project/project-service-watch.test.ts`                    | `it('a backend linked from outside puts the project back in restricted mode [S-84]'`                                                                                                   | `[S-84, R-PJ-16]`                                                                           |
| `packages/server/src/core/project/project-install-job.test.ts`                      | `it('a wrong command fails at once, without a job [R-PJ-13]'`                                                                                                                          | `[R-PJ-13, S-54]`                                                                           |
| `packages/server/src/core/jobs/job-service.test.ts`                                 | `it('sends the newest 20 output lines, then completed [R-PJ-13]'`                                                                                                                      | `[R-PJ-13, V-60]` (test này đã kiểm `stepKey: 'jobs:install.running'`)                      |
| `packages/studio/src/features/canvas-errors/build-error-banner.test.tsx`            | `it('safely renders untrusted text without executing HTML tags [R-RN-25]'`                                                                                                             | `[R-RN-25, S-14]`                                                                           |
| `packages/studio/src/features/project/project-dialog.test.tsx`                      | `it('renders directory browser and probes initial path'`                                                                                                                               | thêm ` [R-PJ-20]`                                                                           |

Kiểm nhanh phần A: `pnpm exec vitest run` cho các file trên (số test **không đổi**).

---

## Phần B: test mới

Mỗi mục: **file** (tạo mới nếu chưa có), **tên test kèm tag**, **cách dựng**, **kết quả phải kiểm**. "Như test X" nghĩa là chép cách dựng của test X trong cùng file.

### B1. Tailwind, `packages/shared/src/tailwind/model.test.ts`

Dùng `ctx` desktop-first sẵn có trong file (`theme` rỗng, `BREAKPOINT_WIDTHS`).

1. `it('keeps variants it does not know as tokens without property [R-TW-03]')`: `parseClasses('dark:bg-black group-hover:p-2 aria-checked:p-1 [&>*]:p-2 md:p-4 max-sm:p-1 hover:p-2 focus:p-3 disabled:p-1 lg:hover:p-6 foo-bar', ctx)` → map `[raw, property]` bằng đúng:
   `[['dark:bg-black', undefined], ['group-hover:p-2', undefined], ['aria-checked:p-1', undefined], ['[&>*]:p-2', undefined], ['md:p-4', 'padding'], ['max-sm:p-1', 'padding'], ['hover:p-2', 'padding'], ['focus:p-3', 'padding'], ['disabled:p-1', 'padding'], ['lg:hover:p-6', 'padding'], ['foo-bar', undefined]]`.
2. `it('reads and writes arbitrary values with spaces as underscores [R-TW-10]')`: `parseClasses('w-[calc(100%_-_2rem)]', ctx)[0]` có `property: 'width'`, `value: { kind: 'arbitrary', css: 'calc(100% - 2rem)' }`; `writeValue('flex', 'width', { breakpoint: 'base' }, { kind: 'arbitrary', css: 'calc(100% - 2rem)' }, ctx)` === `'flex w-[calc(100%_-_2rem)]'`.
3. `it('converts px to the spacing scale or an arbitrary value [R-TW-08]')`: `pxToSpacing(40)` → `{kind:'scale',token:'10'}`; `pxToSpacing(13)` → `{kind:'arbitrary',css:'13px'}`; `pxToSpacing(0)` → `{kind:'scale',token:'0'}`; `pxToSpacing(1)` → `{kind:'scale',token:'px'}`; `pxToSpacing(6)` → `{kind:'scale',token:'1.5'}`; `pxToSpacing(16, 8)` → `{kind:'scale',token:'2'}`. (Nếu Scenario 13 đã kiểm đúng các giá trị này thì chỉ cần phần A; vẫn thêm test này nếu Scenario 13 thiếu `0`, `1px` hoặc `1.5`.)

### B2. Bridge, `packages/bridge/src/client/`

Dùng bộ dựng sẵn của `bridge-client-runtime.test.ts`: `fromStudio(type, payload)`, `sentOfType(type)`, `clickIsIntercepted()`, `runtime`, `hot`, DOM có `<main data-rc-loc="src/App.tsx:1:1"><p>…</p></main>`. Đặt các test mới trong một `describe('core behaviour')` mới ở cuối file.

1. `it('does nothing outside the Studio iframe [R-BR-10]')` trong **file mới** `entry.test.ts`: trong happy-dom `window.parent === window`. `vi.spyOn(window, 'postMessage')`; `await import('./entry.ts')`; kiểm `postMessage` không được gọi **và** `document.getElementById('__rc_overlay_host')` là `null` (`toBeNull()`).
2. `it('puts the overlay in a closed shadow root and puts it back when removed [R-BR-11]')`: `const host = document.getElementById('__rc_overlay_host')` (dùng `if (!host) throw new Error(...)` để thu hẹp kiểu); kiểm `host.style.position === 'fixed'`, `host.style.zIndex === '2147483647'`, `host.style.pointerEvents === 'none'`, `host.shadowRoot` là `null` (shadow **đóng** nên không đọc được); `host.remove()`; `await Promise.resolve()` (cho MutationObserver chạy); kiểm `document.documentElement.contains(host) === true`.
3. `it('sends one tree with the new element 100 ms after the DOM changes [R-BR-12]')`: `vi.useFakeTimers()`; `vi.advanceTimersByTime(200)` để xả tin đầu; ghi `before = sentOfType('tree').length`; thêm `<section data-rc-loc="src/App.tsx:9:1">` vào `main`; `await Promise.resolve()`; `vi.advanceTimersByTime(99)` → số tin `tree` vẫn bằng `before`; `vi.advanceTimersByTime(1)` → bằng `before + 1`, và tin mới nhất có nút với `ref.loc === 'src/App.tsx:9:1'`.
4. `it('targets the nearest element with data-rc-loc under the pointer, skipping the overlay [R-BR-14]')`: happy-dom **không có** `document.elementsFromPoint`, nên dùng `Object.defineProperty(document, 'elementsFromPoint', { configurable: true, value: () => [overlayHost, p, main, document.body] })` (overlayHost là `#__rc_overlay_host`, `p` là `<p>` không có `data-rc-loc` nằm trong `main`) và xóa lại trong `finally` bằng `Reflect.deleteProperty(document, 'elementsFromPoint')`; phát `new PointerEvent('pointermove', { clientX: 5, clientY: 5 })` trên `window`; kiểm tin `hover` cuối **bằng** `{ ref: { loc: 'src/App.tsx:1:1', index: 0 } }`.
5. `it('draws overlay changes once per animation frame [R-BR-15]')`: `const raf = vi.spyOn(window, 'requestAnimationFrame')`, `const caf = vi.spyOn(window, 'cancelAnimationFrame')`; gửi `fromStudio('highlight', { ref: { loc: 'src/App.tsx:1:1', index: 0 } })` **hai lần** liên tiếp; kiểm `raf` được gọi 2 lần và `expect(caf).toHaveBeenCalledWith(raf.mock.results[0]?.value)`: khung cũ bị hủy, chỉ khung mới được vẽ.
6. `it('sends Undo shortcuts to the Studio in design mode [R-BR-18]')`: không có ô đang sửa chữ; phát `keydown` `{ key: 'z', ctrlKey: true }` trên `window`; kiểm `sentOfType('shortcut')` **bằng** `[{ key: 'Undo', ctrl: true, meta: false, shift: false, alt: false }]` (Bridge chuẩn hóa phím thành `Undo`) và sự kiện (tạo với `cancelable: true`) đã `defaultPrevented`.
7. `it('scrolls the primary element into view when the Studio asks [R-BR-20]')`: gán `main.scrollIntoView = vi.fn()`; `fromStudio('select', { refs: [{ loc: 'src/App.tsx:1:1', index: 0 }], reveal: true })`; kiểm được gọi với `{ block: 'nearest', inline: 'nearest' }`; lần nữa với `reveal: false` → không gọi thêm.
8. `it('posts only to the Studio origin [S-101]')`: lấy spy `window.parent.postMessage` sẵn có; sau khi runtime gửi `ready`, kiểm **mọi** lần gọi có đối số thứ hai bằng hằng `STUDIO` của file, không lần nào là `'*'`.
9. `it('keeps bundler and framework code out of the page client [R-FW-04]')` trong **file mới** `packages/bridge/src/architecture.test.ts`: đọc bằng `readFileSync` mọi file `.ts` (không phải `.test.ts`) trong `src/client/` và `src/transform/`; kiểm không file `client/` nào có `from 'vite'`, `from 'react'`, `from '@babel/`; không file `transform/` nào có `from 'vite'`. Liệt kê file bằng `readdirSync` với `withFileTypes`, không viết tay danh sách.

### B3. Server

Dùng `makeTempDir`, `nodeFs`, `platform`, `writeSupportedProject`, `silentLogger`, `fakeSystem` từ `packages/server/src/core/workspace/test-support.ts`.

1. `packages/server/src/core/project/probe.test.ts` (mới): `it('tells missing, empty and project folders apart [R-PJ-01]')`:
   - `probeProject(join(dir,'nope'), { fs: nodeFs, platform })` → `{ ok: true, value: { kind: 'missing', canCreate: true } }`.
   - Thư mục chỉ có `README.md` → `{ ok: true, value: { kind: 'empty' } }`.
   - Thư mục `writeSupportedProject` → `value.kind === 'project'`.
2. `packages/server/src/core/project/project-install.test.ts` (mới): `it('needs install until vite and react are both in node_modules [R-PJ-06]')`: dự án `writeSupportedProject` → `checkNeedsInstall` = `true`; thêm `node_modules/vite/package.json` (`'{}'`) → vẫn `true`; thêm `node_modules/react/package.json` → `false`.
3. `packages/server/src/core/project/detect-responsive.test.ts` (mới): `it('picks desktop-first when max- variants win, mobile-first otherwise [R-PJ-09]')`: `src/A.tsx` nội dung `<div className="p-4 max-md:p-2 max-sm:p-1 md:p-3" />` → `'desktop-first'`; dự án khác với `<div className="p-1 md:p-2 lg:p-3 max-sm:p-0" />` → `'mobile-first'`. Gọi `detectResponsiveMode(nodeFs, root, 'src')`.
4. `packages/server/src/core/project/theme.test.ts` (mới): `it('reads @theme inline and skips line-height tokens [R-PJ-17]')`: file `t.css` = `'@import "tailwindcss";\n@theme inline {\n  --color-brand: #f00;\n  --text-hero: 3rem;\n  --text-hero--line-height: 1.1;\n  --radius-card: 12px;\n}\n'`; `readThemeTokens(nodeFs, root, 't.css')` → `toEqual({ ok: true, value: { file: 't.css', colors: [{ name: 'brand', value: '#f00' }], fontSizes: [{ name: 'hero', value: '3rem' }], radii: [{ name: 'card', value: '12px' }], fonts: [], shadows: [], breakpoints: [] } })`.
5. `packages/server/src/core/shared/paths.test.ts`, thêm `describe('checkBlockedPath')`:
   - `it('refuses drive roots, the home folder and system folders [S-28]')`: `checkBlockedPath('C:/', 'win32')` → `{ code: 'E012', params: { path: 'C:/', reason: 'driveRoot' } }`; `checkBlockedPath('C:\\Windows\\System32', 'win32')` → reason `'systemFolder'` (path giữ nguyên chuỗi vào); `checkBlockedPath('C:/Users/me', 'win32', 'C:\\Users\\me')` → reason `'homeDir'`; `checkBlockedPath('/etc/nginx', 'linux')` → reason `'systemFolder'`; `checkBlockedPath('D:/work/shop', 'win32', 'C:/Users/me')` → `undefined`.
6. `packages/server/src/core/project/project-backends.test.ts` (mới):
   - `it('marks a backend in a system folder as blocked even when trusted [S-83]')`: workspace file từ `newWorkspaceFile({...})` với `backends: [{ id: 'back000001', path: '/etc', label: 'etc' }]`; `computeBackendInfos(nodeFs, '/work/app', file, 'linux')` → `[{ id: 'back000001', path: '/etc', label: 'etc', status: 'blocked', resolvedPath: '/etc', outsideParent: true }]`.
   - `it('refuses a duplicate backend and an eleventh one [R-PJ-14]')`: dựng như test `[V-03]` trong `project-service-backends.test.ts` (dự án tin cậy, thư mục `api` cạnh dự án); `addBackend(api)` lần 1 ok, lần 2 → `{ ok: false, error: { code: 'E016', params: { reason: 'duplicateBackend' } } }`; tạo thêm 9 thư mục `b1`…`b9`, thêm đủ để có 10 backend; thư mục `b10` → `reason: 'maxBackendsExceeded'`.
7. `packages/server/src/core/source-editor/source-editor-service.test.ts`, thêm:
   - `it('refuses values that are not static, with the reason [R-SE-03]')`: file `src/P.tsx` đúng chuỗi dưới đây; 6 lệnh `applyEdit` và lỗi mong đợi:

     ```
     export function P({ url, name }: { url: string; name: string }) {
       return (
         <main className={cn("a")}>
           <a href={url}>{name}</a>
           <p>Hi {name}</p>
           <img src="/x.png" />
           <b className="x" className="y">t</b>
         </main>
       );
     }
     ```

     | Lệnh                                                                      | `reason`          |
     | ------------------------------------------------------------------------- | ----------------- |
     | `setClassName` `loc 'src/P.tsx:3:5'` `tag 'main'` `after 'p-4'`           | `classExpression` |
     | `setAttribute` `loc 'src/P.tsx:4:7'` `tag 'a'` `name 'href'` `after '/x'` | `attrExpression`  |
     | `setText` `loc 'src/P.tsx:4:7'` `tag 'a'` `before ''` `after 'x'`         | `textExpression`  |
     | `setText` `loc 'src/P.tsx:5:7'` `tag 'p'` `before ''` `after 'x'`         | `textMixed`       |
     | `setText` `loc 'src/P.tsx:6:7'` `tag 'img'` `before ''` `after 'x'`       | `selfClosing`     |
     | `setClassName` `loc 'src/P.tsx:7:7'` `tag 'b'` `after 'z'`                | `duplicateAttr`   |

     Mỗi lệnh → `{ ok: false, error: { code: 'E023', params: { reason } } }` và file không đổi (đọc lại so từng byte).

   - `it('keeps every byte outside the edited value [R-SE-17]')`: nội dung gốc (CRLF, khoảng trắng lạ) `"// keep   this\r\nexport function K() {\r\n  return <div   id=\"k\"  className=\"p-4\"   data-x='1'>\r\n    t\r\n  </div>;\r\n}\r\n"`; `setClassName` `loc 'src/K.tsx:3:10'` `tag 'div'` `before 'p-4'` `after 'p-6'` → file sau **bằng đúng** `gốc.replace('"p-4"', '"p-6"')`.
8. `packages/server/src/adapters/fs/node-file-system.test.ts`, thêm `it('lists neither files nor folders behind a link [S-25]')`: trong `root` tạo thư mục `real`, file `a.txt`, và link `link` trỏ tới thư mục `outside` (dùng cách tạo link của test `[S-22, S-24]` trong cùng file); `fs.readDir(root, '.')` → tên chỉ gồm `a.txt` và `real` (không có `link`).
9. `packages/server/src/adapters/http/routes/settings.test.ts`, thêm `it('refuses a body over 10 MB with E016 before parsing [S-87]')` dùng `app`, `HEADERS`, `dir` sẵn có của file: `app.inject({ method: 'PATCH', url: '/api/v1/settings', headers: HEADERS, payload: '{"x":"' + 'a'.repeat(10 * 1024 * 1024) + '"}' })` → `statusCode 400` và `json()` khớp `{ error: { code: 'E016', params: { reason: 'FST_ERR_CTP_BODY_TOO_LARGE' } } }`; không có file `config.json` mới trong `dir`.
10. `packages/server/src/core/runner/runner-service.test.ts`, thêm (dựng như test `[R-RN-06]` dùng `mockHandle`):
    - `it('cuts long lines and keeps the last 500 lines for E025 [R-RN-08, V-71]')`: cho tiến trình con phát 600 dòng (`line 1`…`line 600`) rồi một dòng dài 2.500 ký tự, rồi thoát mã 1 khi đang `ready`; kiểm `details` của lỗi `crashed` có **tối đa 50 dòng** (R-RN-06), dòng dài bị cắt còn 2.000 ký tự trong sự kiện `runner.log` (lấy từ event bus giả của test), và không sự kiện `runner.log` nào có dòng > 2.000 ký tự.
    - `it('runs the dev server in the project root [S-52]')`: `spawn` giả ghi lại `options.cwd` → bằng gốc dự án.
11. `packages/server/src/core/project/project-install-job.test.ts`, thêm `it('installs in the project root with a 10 minute limit [S-50, S-52, S-55]')`: kiểm `pm.spawn` được gọi với `('pnpm', ['install'], expect.objectContaining({ cwd: t.projectDir, timeoutMs: 600000 }))`.
12. `packages/shared/src/result.test.ts` (mới nếu chưa có) `it('never reuses retired error codes [V-81]')`: `ERROR_CODES` (import thật từ `./result.ts`) không chứa `'E004','E005','E006','E007','E008','E009','E010','E022'`, và chứa `'E001'`…`'E003'`, `'E011'`…`'E021'`, `'E023'`…`'E028'`.
13. `packages/server/src/core/workspace/read-workspace.test.ts` (mới hoặc thêm vào file có sẵn) `it('refuses a workspace.json over 1 MB or nested deeper than 64 [V-106]')`: ghi `'['.repeat(70) + ']'.repeat(70)` → lỗi `{ code: 'E003', params: { file: '.kumicraft/workspace.json', reason: 'invalid' } }` có `details[0].message` chứa `'S-29'`; ghi `' '.repeat(1024 * 1024 + 1)` → `{ code: 'E003', params: { file: '.kumicraft/workspace.json', reason: 'tooLarge' } }`.
14. `packages/server/src/architecture.test.ts` (mới) `it('branches on the framework only inside framework folders [R-FW-03]')`: duyệt mọi `.ts` không phải test trong `packages/server/src`, `packages/studio/src`, `packages/bridge/src`, `packages/shared/src` (dùng `readdirSync` đệ quy); file có chuỗi `'vite-react'` chỉ được nằm trong: `server/src/core/project/frameworks/`, `server/src/runners/`, `bridge/src/integrations/`, `shared/src/workspace-file.ts`, `shared/src/project.ts`, `server/src/core/project/project-workspace-file.ts`, `server/src/index.ts`. Test in ra danh sách file vi phạm trong thông báo lỗi. Nếu chạy lần đầu có file ngoài danh sách: **dừng, báo tên file**, không tự thêm vào danh sách.

### B4. Studio

Dựng như test có sẵn trong cùng file (`initI18n`, `cleanup`, `vi.spyOn(sourceClient, 'fetchElementSource')`, `useSelectionStore`).

1. `inspector-panel.test.tsx` `it('writes with the hover prefix after choosing Hover [R-IN-12]')`: dựng như Scenario 1 nhưng `className` là `'p-4'`, khung Desktop cho cả `frame` và `primaryFrame`; chờ có `interaction-state-select`; lúc này `write-prefix-badge` có chữ `Base`; `fireEvent.change(select, { target: { value: 'hover' } })` → `write-prefix-badge` có chữ **đúng** `hover:`.
2. `components/other-classes-section.test.tsx` (mới) `it('saves the whole class string on Enter [R-IN-17]')`: render `OtherClassesSection` với `rawClassString="p-4 foo"`, `onRawClassChange={spy}`, `tokens={parseClasses('p-4 foo', ctx)}` (ô `raw-class-input` hiện sẵn); `fireEvent.change` thành `'p-6 foo'`, `fireEvent.keyDown(input, { key: 'Enter' })` → `spy` được gọi **đúng một lần** với `'p-6 foo'`; `other-classes-list` có chữ `foo` và không có `p-4`.
3. `project/project-dialog.test.tsx` `it('lists translated reasons for an unsupported folder [R-PJ-21]')`: trong test gọi lại `vi.stubGlobal('fetch', …)` giống `stubApi()` nhưng `/api/v1/project/probe` trả `{ data: { kind: 'project', support: { supported: false, reasons: ['noVite', 'noTailwind'], versions: {}, language: 'js' }, hasWorkspace: false } }`; render `ProjectDialog` như test `[R-PJ-20]`; chờ có chữ `i18next.t('project.reasons.noVite')` (tiếng Anh: `Project does not include Vite in dependencies`) và `i18next.t('project.reasons.noTailwind')` (`Project does not include Tailwind CSS`); `queryByTestId('open-project-btn')` là `null`.
4. `project/backends-view.test.tsx` (mới) `it('lists backends with status and removes one only after confirming [R-PJ-23]')`: 2 backend `{ id: 'be1', label: 'API', path: '../api', status: 'ok', resolvedPath: '/w/api', outsideParent: false }` và `{ id: 'be2', label: 'Old', path: '../old', status: 'missing', resolvedPath: '/w/old', outsideParent: false }`; happy-dom **không có** `window.confirm`, nên `vi.stubGlobal('confirm', vi.fn().mockReturnValueOnce(false).mockReturnValueOnce(true))` (và `vi.unstubAllGlobals()` trong `afterEach`); `backend-item-be2` có chữ `Old`, `../old`, `Missing`; bấm `remove-backend-btn-be1` lần 1 → `onRemoveBackend` không được gọi; lần 2 → được gọi đúng một lần với `'be1'`.

### B5. Quy trình và E2E

1. `e2e/project-flow.e2e.ts` `test('keeps the Studio settings in the test config folder [R-QA-02]')`: `start()`; `await session.api('/api/v1/settings', 'PATCH', { language: 'en' })`; đọc `join(config.path, 'config.json')` → JSON có `language: 'en'`. (Đây là bằng chứng test không chạm cấu hình thật của người dùng.)
2. `scripts/trace.test.mjs` **không** làm. Thay bằng `packages/shared/src/trace-tags.test.ts` `it('reads only bracketed code lists as tags [R-QA-04]')`: import **chính regex của `scripts/trace.mjs`** bằng cách tách hằng `CODE` và hàm đọc tag ra file mới `scripts/trace-tags.mjs` (export `readTags(text): string[]`), `trace.mjs` import lại từ đó (không đổi kết quả của `pnpm trace`); test: `readTags("it('a [R-SE-05]') it('b [R-TW-01, R-TW-02]')")` → `['R-SE-05','R-TW-01','R-TW-02']`; `readTags("it('[SPEC-04 R-IN-18]') it('R-TX-02: x') it('[R-RN-06, Test 1]')")` → `[]`. Vì `shared` không đọc được `scripts/`, đặt test này ở `scripts/trace-tags.test.mjs` và thêm vào `vitest.config.js` một project `node` tên `scripts` với `include: ['scripts/**/*.test.mjs']`. Đây là chỗ duy nhất được sửa `vitest.config.js` và `scripts/trace.mjs`.
3. Mục S-86 (tùy chọn, làm nếu còn sức): `packages/shared/src/tailwind/tokenizer.bench.ts` không làm ở lượt này.

---

## Phần C: dự án mẫu Vite 7 + React 18 + JS (VG-15)

Chủ dự án **đã đồng ý** thêm dependency cho dự án mẫu này. Cách làm đúng spec R-QA-01 (dự án mẫu nằm trong pnpm workspace, test chép mã và liên kết `node_modules`).

1. Tạo `fixtures/projects/vite7-react18-js/` theo cấu trúc `vite8-react19-ts` nhưng **JavaScript**: `index.html`, `vite.config.js`, `src/main.jsx`, `src/index.css` (`@import "tailwindcss";`), `src/pages/Home.jsx` có `<h1>` chữ **`Cửa hàng mẫu`** và một phần tử `className="p-4 text-lg"`, `src/components/Card.jsx`, `.kumicraft/workspace.json` (chép từ dự án mẫu TS, đổi `id` thành `vite7js001` và `name`). Không có `tsconfig.json`.
2. `package.json` của dự án mẫu: `"name": "vite7-react18-js-fixture"`, `"private": true`, `"type": "module"`, phiên bản **chính xác** (không `^`): `vite` bản 7.x mới nhất, `react` và `react-dom` `18.3.1`, `@vitejs/plugin-react` bản hỗ trợ Vite 7 (kiểm `pnpm view @vitejs/plugin-react@<bản> peerDependencies`), `tailwindcss` và `@tailwindcss/vite` 4.x có `peerDependencies` chấp nhận Vite 7. Ghi bản đã chọn và lệnh kiểm vào báo cáo.
3. `pnpm-workspace.yaml`: thêm `- fixtures/projects/vite7-react18-js` vào `packages`. Chạy `pnpm install`. Không đổi `onlyBuiltDependencies`.
4. `e2e/support/copy-fixture.ts`: nếu `fixtures/<name>/node_modules` tồn tại thì liên kết các gói từ **đó** thay vì từ `packages/studio/node_modules` (giữ nguyên cách liên kết `junction`, bỏ `.vite*`). Dự án mẫu TS không đổi hành vi.
5. `e2e/vite7.e2e.ts` (mới), 2 test, chép cách dựng của `canvas-edit.e2e.ts` (`start`, `open`, `trustIfAsked`, `getCanvasFrame`, `ui(...)`):
   - `test('runs a Vite 7 + React 18 JavaScript project in the Canvas [VG-15, AC-02]')`: Canvas có heading `Cửa hàng mẫu`.
   - `test('edits a class in a JSX file and undoes it byte for byte [VG-15, AC-03]')`: chọn phần tử `p-4 text-lg`, đổi class như test AC-03 của `canvas-edit.e2e.ts`, kiểm file `.jsx` trên đĩa có class mới, Undo → nội dung file **bằng đúng** bản gốc.
6. Chạy `pnpm test:e2e` (3 trình duyệt × vi, các project `-en` chạy được test có `[AC-` nên cả 2 test này chạy cả tiếng Anh). Dev server Vite 7 không khởi động được → **dừng, báo** log của runner (`runner.log`), không đổi runner.

Kiểm nhanh phần C: `pnpm build`, `pnpm exec playwright test e2e/vite7.e2e.ts --project=chromium`.

---

## Mẫu báo cáo

1. Phần nào xong, phần nào dừng (vì sao, kèm nguyên văn lỗi).
2. Danh sách file tạo/sửa (đường dẫn, số dòng thêm/bớt) theo phần.
3. Nguyên văn dòng tổng `pnpm verify`, `pnpm test:e2e`, `pnpm test:e2e:network`, và danh sách mã còn thiếu khi chạy `pnpm trace` với `currentPhase: 1` (sau đó trả lại `0`).
4. Phần C: phiên bản đã chọn và kết quả `pnpm view … peerDependencies`.
5. Mọi chỗ làm khác bản này. Không commit.
