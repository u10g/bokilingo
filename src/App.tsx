import { useEffect, useState } from "react";
import { Header } from "./components/parts.tsx";
import { COURSES } from "./content/courses.ts";
import { PASS_RATE, XP_PER_QUESTION, XP_PER_REVIEW } from "./domain/constants.ts";
import {
  bumpStreak,
  findFrontier,
  heartsFor,
  initialProgress,
  restoreProgress,
  todayStr,
  type ProgressSnapshot,
} from "./domain/progress.ts";
import type { LessonResult, Question } from "./domain/types.ts";
import { CourseSelectScreen, ProgressDetailScreen, StreakDetailScreen } from "./screens/DetailScreens.tsx";
import { LessonScreen } from "./screens/LessonScreen.tsx";
import { MapScreen } from "./screens/MapScreen.tsx";
import { ClearScreen, HeartsEmptyScreen } from "./screens/ResultScreens.tsx";
import { ReviewScreen } from "./screens/ReviewScreen.tsx";
import { clearProgress, loadProgress, saveProgress } from "./storage.ts";

/* ---------------------------------------------------------
   ルートコンポーネント
   状態はすべてここで持ち、画面コンポーネントは props で受け取って表示する。
   進捗は確定する契機（誤答・復習正解・レッスンクリア・コース切替）でのみ保存する。
--------------------------------------------------------- */

type Screen = "map" | "lesson" | "clear" | "heartsEmpty" | "streakDetail" | "progressDetail" | "review" | "courseSelect";

export default function App() {
  const [loaded, setLoaded] = useState(false);
  const [screen, setScreen] = useState<Screen>("map");
  const [progress, setProgress] = useState<ProgressSnapshot>(() => initialProgress(COURSES, todayStr()));
  const [activeNodeIndex, setActiveNodeIndex] = useState<number | null>(null);
  const [sheetIndex, setSheetIndex] = useState<number | null>(null);
  const [lastResult, setLastResult] = useState<LessonResult | null>(null);
  const [attemptId, setAttemptId] = useState(0); // 挑戦ごとに出題順を引き直すためのキー

  const { activeCourseId, completedSets, solvedCount, totalXp, streak, lastActiveDate, wrongToday } = progress;
  const hearts = heartsFor(wrongToday);
  const currentCourse = COURSES.find((c) => c.id === activeCourseId) ?? COURSES[0];
  const currentNodes = currentCourse.nodes;
  const currentCompletedSet = completedSets[currentCourse.id];
  const frontier = findFrontier(currentNodes.length, currentCompletedSet);

  // 初回読み込み：保存済みの進捗があれば復元する
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const data = await loadProgress();
      if (cancelled) return;
      setProgress(restoreProgress(data, COURSES, todayStr()));
      setLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // ライフが尽きたら、フィードバックを見せてからライフ切れ画面へ
  useEffect(() => {
    if (hearts === 0 && screen === "lesson") {
      const t = setTimeout(() => setScreen("heartsEmpty"), 600);
      return () => clearTimeout(t);
    }
  }, [hearts, screen]);

  const commit = (next: ProgressSnapshot) => {
    setProgress(next);
    void saveProgress(next);
  };

  const handleStart = (i: number) => {
    setSheetIndex(null);
    setActiveNodeIndex(i);
    setAttemptId((n) => n + 1);
    setScreen("lesson");
  };

  const handleWrongAnswer = (question: Question, nodeTitle: string) => {
    if (wrongToday.some((w) => w.key === question.id)) return;
    commit({
      ...progress,
      wrongToday: [...wrongToday, { key: question.id, nodeTitle, question }],
      wrongTodayDate: todayStr(),
    });
  };

  const handleReviewCorrect = (key: string) => {
    const today = todayStr();
    const bumped = bumpStreak(streak, lastActiveDate, today);
    commit({
      ...progress,
      wrongToday: wrongToday.filter((w) => w.key !== key),
      wrongTodayDate: today,
      solvedCount: solvedCount + 1,
      totalXp: totalXp + XP_PER_REVIEW, // 復習の正解にも少しXPを付ける
      streak: bumped.streak,
      lastActiveDate: bumped.lastActiveDate,
    });
  };

  const handleLessonComplete = (result: LessonResult) => {
    if (activeNodeIndex === null) return;
    setLastResult(result);

    const node = currentNodes[activeNodeIndex];
    const accuracy = (result.total - result.missed) / result.total;
    // チェックポイントは合格ラインに届かないとクリア扱いにしない
    const cleared = node.kind !== "checkpoint" || accuracy >= PASS_RATE;
    const bumped = bumpStreak(streak, lastActiveDate, todayStr());

    commit({
      ...progress,
      completedSets: cleared
        ? { ...completedSets, [currentCourse.id]: new Set(currentCompletedSet).add(activeNodeIndex) }
        : completedSets,
      solvedCount: solvedCount + result.total,
      totalXp: totalXp + result.total * XP_PER_QUESTION,
      streak: bumped.streak,
      lastActiveDate: bumped.lastActiveDate,
    });
    setScreen("clear");
  };

  const handleClearContinue = () => {
    setActiveNodeIndex(null);
    setScreen("map");
  };

  // チェックポイント不合格からの再挑戦
  const handleRetry = () => {
    setLastResult(null);
    setAttemptId((n) => n + 1);
    setScreen("lesson");
  };

  const handleSelectCourse = (id: string) => {
    setSheetIndex(null);
    setActiveNodeIndex(null);
    setScreen("map");
    commit({ ...progress, activeCourseId: id });
  };

  const handleResetData = async () => {
    await clearProgress();
    setProgress(initialProgress(COURSES, todayStr()));
    setActiveNodeIndex(null);
    setSheetIndex(null);
    setScreen("map");
  };

  const backToMap = () => setScreen("map");

  if (!loaded) {
    return (
      <div className="max-w-sm mx-auto min-h-screen bg-white flex items-center justify-center">
        <p className="text-gray-400 font-bold text-sm">よみこみ中…</p>
      </div>
    );
  }

  return (
    <div className="max-w-sm mx-auto min-h-screen bg-white font-sans">
      {screen === "map" && (
        <>
          <Header
            courseTitle={currentCourse.title}
            streak={streak}
            solvedCount={solvedCount}
            hearts={hearts}
            onOpenCourses={() => setScreen("courseSelect")}
            onOpenStreak={() => setScreen("streakDetail")}
            onOpenProgress={() => setScreen("progressDetail")}
            onOpenReview={() => setScreen("review")}
          />
          <MapScreen
            course={currentCourse}
            completedSet={currentCompletedSet}
            frontier={frontier}
            sheetIndex={sheetIndex}
            onTapNode={setSheetIndex}
            onStart={handleStart}
            onCloseSheet={() => setSheetIndex(null)}
          />
        </>
      )}

      {screen === "lesson" && activeNodeIndex !== null && (
        <LessonScreen
          key={`${currentCourse.id}-${activeNodeIndex}-${attemptId}`}
          node={currentNodes[activeNodeIndex]}
          hearts={hearts}
          onWrongAnswer={(q) => handleWrongAnswer(q, currentNodes[activeNodeIndex].title)}
          onExit={backToMap}
          onComplete={handleLessonComplete}
        />
      )}

      {screen === "clear" && lastResult && activeNodeIndex !== null && (
        <ClearScreen result={lastResult} node={currentNodes[activeNodeIndex]} onContinue={handleClearContinue} onRetry={handleRetry} />
      )}

      {screen === "heartsEmpty" && (
        <HeartsEmptyScreen
          onReview={() => setScreen("review")}
          onBackToMap={() => {
            setActiveNodeIndex(null);
            setScreen("map");
          }}
        />
      )}

      {screen === "streakDetail" && <StreakDetailScreen streak={streak} lastActiveDate={lastActiveDate} onClose={backToMap} />}

      {screen === "progressDetail" && (
        <ProgressDetailScreen
          courses={COURSES}
          solvedCount={solvedCount}
          totalXp={totalXp}
          completedSets={completedSets}
          onResetData={handleResetData}
          onClose={backToMap}
        />
      )}

      {screen === "review" && <ReviewScreen wrongToday={wrongToday} onCorrect={handleReviewCorrect} onClose={backToMap} />}

      {screen === "courseSelect" && (
        <CourseSelectScreen
          courses={COURSES}
          activeCourseId={currentCourse.id}
          completedSets={completedSets}
          onSelect={handleSelectCourse}
          onClose={backToMap}
        />
      )}
    </div>
  );
}
