import { Atom, Beaker, Brain, HeartPulse, Microscope, Building2 } from "lucide-react";

const LABS = [
  { name: "Lab 1", Icon: Microscope },
  { name: "Lab 2", Icon: HeartPulse },
  { name: "Lab 3", Icon: Brain },
  { name: "Lab 4", Icon: Beaker },
  { name: "Lab 5", Icon: Atom },
  { name: "Lab 6", Icon: Microscope },
  { name: "Lab 7", Icon: HeartPulse },
  { name: "Lab 8", Icon: Beaker },
];

function BeltRow({ ariaHidden }: { ariaHidden: boolean }) {
  return (
    <div aria-hidden={ariaHidden} className="flex items-center gap-x-16 pr-16">
      {LABS.map((lab, index) => (
        <span
          key={`${lab.name}-${index}`}
          className="inline-flex items-center gap-2 transition-transform hover:scale-[1.05]"
        >
          <lab.Icon className="size-5 text-[#d9dcd4]" aria-hidden="true" />
          <span className="whitespace-nowrap text-[18px] font-medium text-[#d9dcd4] tracking-[-0.2px]">{lab.name}</span>
        </span>
      ))}
    </div>
  );
}

export function PartnerBelt() {
  return (
    <div className="relative z-10 pb-10 sm:pb-14">
      <p className="mb-6 px-6 text-center text-[12px] font-medium uppercase tracking-[0.14em] text-white/78">
        First pilot cohort
      </p>

      <div className="flex flex-wrap items-center justify-center gap-x-12 gap-y-7 px-6 sm:gap-x-20">
        <span className="inline-flex items-center gap-3.5 sm:gap-[18px]">
          <Building2 className="size-12 text-[#d9dcd4] sm:size-[60px]" strokeWidth={1.25} aria-hidden="true" />
          <span className="whitespace-nowrap text-[26px] font-medium tracking-[-0.4px] text-[#d9dcd4] sm:text-[34px]">
            McMaster University
          </span>
        </span>
      </div>

      <div className="rb-belt-wrap mt-7 overflow-hidden sm:mt-9 [mask-image:linear-gradient(to_right,transparent,black_12%,black_88%,transparent)]">
        <div className="rb-belt flex w-max">
          <BeltRow ariaHidden={false} />
          <BeltRow ariaHidden />
        </div>
      </div>

      <p className="mt-7 px-6 text-center text-[12px] leading-5 text-white/65">
        Partner labs are shown as placeholders while the September 2026 cohort is confirmed. Expansion to further
        faculties and universities follows the pilot.
      </p>
    </div>
  );
}
