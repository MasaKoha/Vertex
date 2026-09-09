/** 一行形式を壊さず表示文字を比較できるよう空白を揃える。 */
export function normalizeLabel(value: string): string {
  return value.replace(/\s+/gu, ' ').trim();
}

/** 入力後の値を属性より優先して検索に利用する。 */
export function readElementValue(element: Element): string | null {
  if ('value' in element && typeof element.value === 'string') {
    return element.value;
  }
  return element.getAttribute('value');
}

/** ラベル源の候補を正規化して返す。 */
function labelCandidates(element: Element): string[] {
  const sources = [element.textContent, element.getAttribute('aria-label'),
    element.getAttribute('placeholder'), element.getAttribute('alt'), readElementValue(element)];
  return sources.filter((source): source is string => source !== null).map(normalizeLabel);
}

/** ラベル源のいずれかが完全に一致するか。曖昧な部分一致より優先して解決するために使う。 */
export function matchesLabelExactly(element: Element, label: string): boolean {
  const query = normalizeLabel(label);
  if (!query) {
    return false;
  }
  return labelCandidates(element).some(candidate => candidate === query);
}

/** 設計書の五つのラベル源を個別に照合する。 */
export function matchesLabel(element: Element, label: string): boolean {
  const query = normalizeLabel(label);
  if (!query) {
    return false;
  }
  const candidates = [element.textContent, element.getAttribute('aria-label'),
    element.getAttribute('placeholder'), element.getAttribute('alt'), readElementValue(element)];
  return candidates.some(candidate => candidate !== null && normalizeLabel(candidate).includes(query));
}

/** 表示文字を優先し、文字がなければ代替ラベルを使う。 */
export function getElementLabel(element: Element): string {
  const candidates = [element.textContent, element.getAttribute('aria-label'),
    element.getAttribute('placeholder'), element.getAttribute('alt'), readElementValue(element)];
  for (const candidate of candidates) {
    const label = normalizeLabel(candidate ?? '');
    if (label) {
      return label;
    }
  }
  return '';
}

/** 入力値は value 属性で表すため表示文字と重複させない。 */
export function getDisplayLabel(element: Element): string {
  if (!element.matches('input,textarea')) {
    return getElementLabel(element);
  }
  const candidates = ['aria-label', 'placeholder', 'alt']
    .map(attribute => normalizeLabel(element.getAttribute(attribute) ?? ''));
  return candidates.find(label => label.length > 0) ?? '';
}
