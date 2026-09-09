import { escapeLine } from '../observe/element/ElementAttributes';

/** 文字列はそのまま、構造化状態は JSON で一行に収める。 */
export function formatStateValue(value: unknown): string {
  if (typeof value !== 'object' || value === null) {
    return escapeLine(String(value));
  }
  try {
    return escapeLine(JSON.stringify(value) ?? String(value));
  } catch {
    return '[unserializable]';
  }
}
