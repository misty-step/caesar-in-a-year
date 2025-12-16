import { LatinText } from '@/components/UI/LatinText';

/** View model for dashboard stats display */
export type UserProgressVM = {
  currentDay: number;
  totalXp: number;
  streak: number;
  unlockedPhase: number;
};

interface StatsProps {
  progress: UserProgressVM;
  reviewCount: number;
  readingTitle: string;
}

export function Stats({ progress, reviewCount, readingTitle }: StatsProps) {
  return (
    <section className="grid gap-4 md:grid-cols-3">
      <div className="bg-white rounded-xl shadow-sm border border-roman-200 p-6 flex flex-col justify-between">
        <div className="space-y-2">
          <span className="text-xs font-bold uppercase tracking-widest text-roman-500">
            <LatinText latin="Progressus Hodiernus" english="Current Progress" />
          </span>
          <h2 className="text-2xl font-serif text-roman-900">
            <LatinText latin={`Dies ${progress.currentDay} ex CCCLXV`} english={`Day ${progress.currentDay} of 365`} />
          </h2>
          <p className="text-sm text-roman-600">
            <LatinText latin="Phasis I: Fundamenta" english="Phase 1: Foundations" />
          </p>
        </div>
        <p className="mt-4 text-xs text-roman-500">
          <LatinText latin="Gradatim procedimus." english="We advance step by step." />
        </p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-roman-200 p-6 flex flex-col items-center justify-center">
        <div className="text-4xl font-serif text-pompeii-600 mb-1">{progress.streak}</div>
        <span className="text-xs uppercase text-roman-400 font-bold">
          <LatinText latin="Series Dierum" english="Day Streak" />
        </span>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-roman-200 p-6 space-y-2">
        <span className="text-xs font-bold uppercase tracking-widest text-roman-500">
          <LatinText latin="Quid Hodie Legis?" english="What do you read today?" />
        </span>
        <p className="text-sm font-medium text-roman-900">{readingTitle}</p>
        <p className="text-xs text-roman-600">
          <LatinText
            latin={`Sententiae recognoscendae: ${reviewCount}`}
            english={`Sentences to review: ${reviewCount}`}
          />
        </p>
      </div>
    </section>
  );
}
