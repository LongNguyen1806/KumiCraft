// Top-50+ Vietnamese & English keyword search for offline Lucide icons (K9.7-2 TK-6).

const VI_KEYWORD_SYNONYMS: Readonly<Record<string, readonly string[]>> = {
  tim: ['heart', 'heart-pulse', 'heart-handshake'],
  'trai tim': ['heart', 'heart-pulse'],
  'yeu thich': ['heart', 'star', 'bookmark'],
  nha: ['home', 'house'],
  'trang chu': ['home', 'house'],
  'tim kiem': ['search', 'scan-search'],
  'kinh lup': ['search', 'zoom-in'],
  'cai dat': ['settings', 'sliders-horizontal', 'cog'],
  'banh rang': ['settings', 'cog'],
  nguoi: ['user', 'users', 'user-round'],
  'tai khoan': ['user', 'user-circle', 'circle-user'],
  thu: ['mail', 'inbox', 'send'],
  email: ['mail', 'at-sign'],
  chuong: ['bell', 'bell-ring'],
  'thong bao': ['bell', 'megaphone'],
  lich: ['calendar', 'calendar-days'],
  'dong ho': ['clock', 'alarm-clock', 'timer'],
  sao: ['star', 'sparkles'],
  'gio hang': ['shopping-cart', 'shopping-bag'],
  'mua sam': ['shopping-bag', 'shopping-cart', 'store'],
  anh: ['image', 'images', 'camera'],
  'hinh anh': ['image', 'images', 'gallery'],
  video: ['video', 'film', 'clapperboard'],
  nhac: ['music', 'headphones', 'volume-2'],
  'am thanh': ['volume-2', 'speaker', 'mic'],
  'tai ve': ['download', 'cloud-download'],
  'tai len': ['upload', 'cloud-upload'],
  'chia se': ['share', 'share-2', 'forward'],
  'thung rac': ['trash', 'trash-2'],
  xoa: ['trash', 'trash-2', 'x', 'eraser'],
  but: ['pencil', 'pen', 'square-pen'],
  'chinh sua': ['pencil', 'square-pen', 'edit'],
  luu: ['save', 'bookmark'],
  khoa: ['lock', 'unlock', 'key'],
  'bao mat': ['shield', 'shield-check', 'lock'],
  mat: ['eye', 'eye-off'],
  'mat troi': ['sun', 'sunrise'],
  sang: ['sun', 'lightbulb', 'sparkles'],
  'mat trang': ['moon'],
  toi: ['moon', 'moon-star'],
  may: ['cloud', 'cloud-rain'],
  lua: ['flame'],
  'tia chop': ['zap'],
  'mui ten': ['arrow-right', 'arrow-left', 'arrow-up', 'arrow-down', 'chevron-right'],
  'dau cong': ['plus', 'circle-plus'],
  them: ['plus', 'circle-plus', 'square-plus'],
  'dau tru': ['minus', 'circle-minus'],
  'dau tich': ['check', 'circle-check', 'check-check'],
  dung: ['check', 'circle-check'],
  dong: ['x', 'circle-x'],
  'canh bao': ['triangle-alert', 'circle-alert', 'alert'],
  'thong tin': ['info', 'badge-info'],
  'giup do': ['circle-help', 'life-buoy'],
  hoi: ['circle-help'],
  'thu muc': ['folder', 'folder-open'],
  tep: ['file', 'file-text'],
  'tai lieu': ['file-text', 'files'],
  sach: ['book', 'book-open'],
  'dien thoai': ['phone', 'smartphone'],
  goi: ['phone', 'phone-call'],
  'ban do': ['map', 'map-pin', 'compass'],
  'vi tri': ['map-pin', 'locate'],
  co: ['flag'],
  qua: ['gift'],
  tien: ['wallet', 'banknote', 'dollar-sign', 'coins'],
  vi: ['wallet', 'credit-card'],
  'bieu do': ['chart-bar', 'chart-line', 'chart-pie', 'trending-up'],
  'thong ke': ['chart-bar', 'trending-up', 'activity'],
  ma: ['code', 'terminal', 'braces'],
  'lien ket': ['link', 'link-2', 'external-link'],
  loc: ['filter', 'sliders-horizontal'],
  'sap xep': ['arrow-up-down', 'list-ordered'],
  menu: ['menu', 'panel-left'],
  mang: ['globe', 'wifi', 'network'],
  'tro chuyen': ['message-circle', 'message-square', 'messages-square'],
  'tin nhan': ['message-circle', 'message-square', 'mail'],
  'lam moi': ['refresh-cw', 'rotate-cw'],
};

const VI_KEYWORD_ENTRIES = Object.entries(VI_KEYWORD_SYNONYMS);

export function normalizeIconQuery(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd');
}

function expandSearchTerms(normalizedQuery: string): readonly string[] {
  if (normalizedQuery === '') return [];
  const terms = new Set<string>([normalizedQuery, normalizedQuery.replace(/\s+/g, '-')]);
  for (const [viPhrase, enTerms] of VI_KEYWORD_ENTRIES) {
    if (viPhrase === normalizedQuery || viPhrase.includes(normalizedQuery)) {
      for (const term of enTerms) {
        terms.add(term);
      }
    }
  }
  return [...terms];
}

export function matchIconSearch(iconName: string, rawQuery: string): boolean {
  const normalized = normalizeIconQuery(rawQuery);
  if (normalized === '') return true;
  const terms = expandSearchTerms(normalized);
  return terms.some((term) => iconName.includes(term));
}
