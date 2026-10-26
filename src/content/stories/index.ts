import type { Story } from "../../domain/types.ts";
import { ADJUSTED_TB_STORY } from "./adjustedTb.ts";
import { ADJUSTED_TB_STORY_2 } from "./adjustedTb2.ts";
import { LEDGER_STORIES } from "./ledger.ts";
import { STATEMENTS_STORY } from "./statements.ts";
import { STATEMENTS_STORY_2 } from "./statements2.ts";
import { WORKSHEET_STORY } from "./worksheet.ts";
import { WORKSHEET_STORY_2 } from "./worksheet2.ts";

/* ---------------------------------------------------------
   ストーリー一覧
   各ストーリーは topicId の論点のレッスンの直後に、この順で置かれる（両コース共通）。
--------------------------------------------------------- */

export const STORIES: Story[] = [WORKSHEET_STORY, WORKSHEET_STORY_2, ADJUSTED_TB_STORY, ADJUSTED_TB_STORY_2, STATEMENTS_STORY, STATEMENTS_STORY_2, ...LEDGER_STORIES];
