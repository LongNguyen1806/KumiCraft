// A real compile used by the source-map tests: `src/styles/main.scss` (`@use './card'`) as
// Vite 8 + sass 1.83 serve it with `css.devSourcemap` (R-ST-04).

/** Compiled rules: 0 `.base, .note`, 1 `.card`, 2 `.card .title`, 3 `@media .card`, 4 `.note`. */
export const SASS_COMPILED =
  '.base, .note {\n  border-radius: 4px;\n}\n\n.card {\n  padding: 16px;\n  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);\n}\n.card .title {\n  font-size: 18px;\n}\n@media (max-width: 640px) {\n  .card {\n    padding: 8px;\n  }\n}\n\n.note {\n  color: red;\n}\n/*# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJfY2FyZC5zY3NzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUlBO0VBQ0U7OztBQUVGO0VBQ0U7RUFOQTs7QUFRQTtFQUNFOztBQUVGO0VBTkY7SUFPSTs7OztBQUdKO0VBRUUiLCJzb3VyY2VzQ29udGVudCI6WyIvLyBDYXJkIHN0eWxlc1xuQG1peGluIHJhaXNlZCB7XG4gIGJveC1zaGFkb3c6IDAgMXB4IDJweCAjMDAwMztcbn1cbi5iYXNlIHtcbiAgYm9yZGVyLXJhZGl1czogNHB4O1xufVxuLmNhcmQge1xuICBwYWRkaW5nOiAxNnB4O1xuICBAaW5jbHVkZSByYWlzZWQ7XG4gIC50aXRsZSB7XG4gICAgZm9udC1zaXplOiAxOHB4O1xuICB9XG4gIEBtZWRpYSAobWF4LXdpZHRoOiA2NDBweCkge1xuICAgIHBhZGRpbmc6IDhweDtcbiAgfVxufVxuLm5vdGUge1xuICBAZXh0ZW5kIC5iYXNlO1xuICBjb2xvcjogcmVkO1xufVxuIl19 */';

/** `src/styles/_card.scss`, the partial every compiled rule comes from. */
export const SASS_PARTIAL =
  '// Card styles\n@mixin raised {\n  box-shadow: 0 1px 2px #0003;\n}\n.base {\n  border-radius: 4px;\n}\n.card {\n  padding: 16px;\n  @include raised;\n  .title {\n    font-size: 18px;\n  }\n  @media (max-width: 640px) {\n    padding: 8px;\n  }\n}\n.note {\n  @extend .base;\n  color: red;\n}\n';

/** `src/styles/main.scss`. */
export const SASS_MAIN = "$brand: #e11d48;\n$radius-card: 12px;\n@use './card';\n";
