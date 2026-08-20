import { Plus } from "lucide-react";

export type FaqItem = { question: string; answer: string[] };

export const FAQ_ITEMS: FaqItem[] = [
  {
    question: "Is ResearchBridge free for students?",
    answer: ["Yes. ResearchBridge is free for students."],
  },
  {
    question: "I am in first year and have no research experience. Should I sign up?",
    answer: [
      "Yes. Previous research experience is not universally required. Researchers define the requirements for each project, and many positions are written for students who are starting out.",
    ],
  },
  {
    question: "What makes a strong application?",
    answer: [
      "Applications should demonstrate genuine familiarity with the research and respond to the specific project rather than sending a generic statement of interest.",
      "Researchers may ask students to read a paper or respond to a project-specific question.",
    ],
  },
  {
    question: "How am I evaluated?",
    answer: [
      "Researchers define criteria for their own projects. A student's relevance is evaluated separately for each opportunity.",
      "There is no single ranking attached to a student across ResearchBridge.",
    ],
  },
  {
    question: "Will I have to record a video?",
    answer: [
      "Only if a researcher enables a video response for that particular position. It is not a general ResearchBridge requirement, and you are told before you begin the application.",
    ],
  },
  {
    question: "How is my information used?",
    answer: [
      "Profile and application information is made available to authorized researchers as required to review the applications you submit.",
      "Contact information is used for ResearchBridge communication. Researcher notes are private to the researcher and are never shown to students.",
    ],
  },
  {
    question: "Are opportunities paid?",
    answer: [
      "ResearchBridge supports paid, unpaid, volunteer, and academic-credit opportunities. Every listing indicates its compensation category before students apply.",
    ],
  },
  {
    question: "What happens after the pilot?",
    answer: [
      "Feedback will be collected from participating students and researchers and used to improve the platform before broader expansion.",
    ],
  },
];

export function FaqList({ items = FAQ_ITEMS }: { items?: FaqItem[] }) {
  return (
    <div className="divide-y divide-line border-y border-line">
      {items.map((item) => (
        <details key={item.question} className="group">
          <summary className="flex cursor-pointer list-none items-start justify-between gap-6 py-5 text-left">
            <span className="font-display text-[17px] leading-7 text-ink sm:text-[19px]">{item.question}</span>
            <span
              aria-hidden="true"
              className="mt-1 inline-flex size-6 shrink-0 items-center justify-center rounded-full border border-line-strong text-muted transition-transform group-open:rotate-45"
            >
              <Plus className="size-3.5" />
            </span>
          </summary>
          <div className="rb-measure pb-6 pr-10">
            {item.answer.map((paragraph) => (
              <p key={paragraph} className="mt-2 text-[14.5px] leading-7 text-muted first:mt-0">
                {paragraph}
              </p>
            ))}
          </div>
        </details>
      ))}
    </div>
  );
}
