import { Fragment, useEffect, useRef } from "react";
import { NodeSheet, PathNode, SectionBanner, UnitDivider } from "../components/parts.tsx";
import { getNodeState } from "../domain/progress.ts";
import type { Course } from "../domain/types.ts";

/* ---------------------------------------------------------
   マップ画面
   レッスンはフラットな配列で持ち、chapter が変わった箇所で章バナーを差し込む。
--------------------------------------------------------- */

export function MapScreen({
  course,
  completedSet,
  frontier,
  sheetIndex,
  onTapNode,
  onStart,
  onCloseSheet,
}: {
  course: Course;
  completedSet: Set<string>;
  frontier: number;
  sheetIndex: number | null;
  onTapNode: (i: number) => void;
  onStart: (i: number) => void;
  onCloseSheet: () => void;
}) {
  const { nodes, chapters, stubNote } = course;
  const currentRef = useRef<HTMLDivElement>(null);

  // レッスン数が多いため、開いたときに現在地まで自動で送る
  useEffect(() => {
    currentRef.current?.scrollIntoView({ block: "center", behavior: "auto" });
  }, []);

  // セクションごとの進捗を先に集計する
  const chapterStats: Record<string, { done: number; total: number }> = {};
  nodes.forEach((n) => {
    chapterStats[n.chapter] ??= { done: 0, total: 0 };
    chapterStats[n.chapter].total += 1;
    if (completedSet.has(n.id)) chapterStats[n.chapter].done += 1;
  });

  return (
    <div className="px-6 pt-6 pb-16 flex flex-col items-center">
      {nodes.map((node, i) => {
        const state = getNodeState(nodes, i, completedSet, frontier);
        const prev = nodes[i - 1];
        const isNewChapter = !prev || node.chapter !== prev.chapter;
        const isNewUnit = !prev || node.unit !== prev.unit;
        return (
          <Fragment key={node.id}>
            {isNewChapter && <SectionBanner info={chapters[node.chapter]} stats={chapterStats[node.chapter]} />}
            {(isNewChapter || isNewUnit) && node.unit && <UnitDivider label={node.unit} />}
            <div ref={state === "current" ? currentRef : null} className="flex flex-col items-center">
              <PathNode node={node} index={i} state={state} onTap={onTapNode} />
            </div>
          </Fragment>
        );
      })}

      <div className="w-full bg-gray-50 border border-dashed border-gray-300 rounded-2xl p-4 text-center mt-2">
        <p className="text-sm font-bold text-gray-400">{stubNote}</p>
      </div>

      {sheetIndex !== null && (
        <NodeSheet
          node={nodes[sheetIndex]}
          state={getNodeState(nodes, sheetIndex, completedSet, frontier)}
          onStart={() => onStart(sheetIndex)}
          onClose={onCloseSheet}
        />
      )}
    </div>
  );
}
