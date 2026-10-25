import { serializeProgress, type ProgressSnapshot, type SavedProgress } from "./domain/progress.ts";

/* ---------------------------------------------------------
   永続化
   進捗はすべて1つのキーにまとめて localStorage に保存する。
   モックの window.storage と同じく非同期のIFにしておき、
   保存先を差し替えても呼び出し側を変えずに済むようにする。
   読み書きの失敗は握りつぶし、メモリ上での動作を継続する。
--------------------------------------------------------- */

// v2: コース構造の変更に伴い、クリア済みをレッスンIDで持つ形式に変えた。v1 の進捗は引き継がない
export const STORAGE_KEY = "boki-quest-progress-v2";

export async function loadProgress(): Promise<SavedProgress | null> {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as SavedProgress;
  } catch {
    return null; // 初回アクセスや壊れたデータは既定値で始める
  }
}

export async function saveProgress(snapshot: ProgressSnapshot): Promise<void> {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(serializeProgress(snapshot)));
  } catch {
    // 保存に失敗してもアプリの利用自体は継続する
  }
}

export async function clearProgress(): Promise<void> {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // キーが無い場合などは無視する
  }
}
