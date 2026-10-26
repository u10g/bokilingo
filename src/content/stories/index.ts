import type { Story } from "../../domain/types.ts";
import { ADJUSTED_TB_STORY } from "./adjustedTb.ts";
import { STATEMENTS_STORY } from "./statements.ts";
import { WORKSHEET_STORY } from "./worksheet.ts";

/* ---------------------------------------------------------
   ストーリー一覧
   各ストーリーは topicId の論点のレッスンの直後に置かれる（両コース共通）。
--------------------------------------------------------- */

export const STORIES: Story[] = [WORKSHEET_STORY, ADJUSTED_TB_STORY, STATEMENTS_STORY];
