import type { Story } from "../../domain/types.ts";
import { WORKSHEET_STORY } from "./worksheet.ts";

/* ---------------------------------------------------------
   ストーリー一覧
   各ストーリーは topicId の論点のレッスンの直後に置かれる（両コース共通）。
--------------------------------------------------------- */

export const STORIES: Story[] = [WORKSHEET_STORY];
