import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, type LucideIcon } from "lucide-react";
import type { Scene, SceneLink } from "../../shared/api";
import { IconButton } from "../components/IconButton";

export interface SceneStepsProps {
  sceneId: string;
  scenes: Scene[];
  links: SceneLink[];
  onStep: (sceneId: string) => void;
  onPrefetch: (sceneId: string) => void;
}

interface Step {
  sceneId: string;
  name: string;
  /** The link's label, shown under the scene name when there is a choice. */
  label: string;
}

/** Previous/next arrows that follow the campaign's links out of the open scene. */
export function SceneSteps({ sceneId, scenes, links, onStep, onPrefetch }: SceneStepsProps) {
  const names = new Map(scenes.map((s) => [s.id, s.name]));
  const steps = (from: "source" | "target", to: "source" | "target"): Step[] =>
    links
      .filter((l) => l[from] === sceneId && names.has(l[to]))
      .map((l) => ({ sceneId: l[to], name: names.get(l[to]) || "Untitled scene", label: l.label }));
  const previous = steps("target", "source");
  const next = steps("source", "target");

  // Neighbours are likely the next stop, so their graphs are fetched ahead of the click.
  const neighbours = [...previous, ...next].map((s) => s.sceneId).join(" ");
  useEffect(() => {
    if (neighbours) neighbours.split(" ").forEach(onPrefetch);
  }, [neighbours, onPrefetch]);

  return (
    <span className="scene-steps">
      <StepButton icon={ChevronLeft} direction="Previous" steps={previous} onStep={onStep} />
      <StepButton icon={ChevronRight} direction="Next" steps={next} onStep={onStep} />
    </span>
  );
}

interface StepButtonProps {
  icon: LucideIcon;
  direction: "Previous" | "Next";
  steps: Step[];
  onStep: (sceneId: string) => void;
}

/** One linked scene steps straight to it; several open a menu to pick from. */
function StepButton({ icon, direction, steps, onStep }: StepButtonProps) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      // Claims the key so the scene's Escape (close the layer) does not fire on the same press.
      e.preventDefault();
      setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // The steps change under an open menu when its scene is left; it should not follow.
  const stepsKey = steps.map((s) => s.sceneId).join(" ");
  useEffect(() => setOpen(false), [stepsKey]);

  if (steps.length <= 1) {
    const only = steps[0];
    return (
      <IconButton
        icon={icon}
        label={only ? `${direction} scene: ${only.name}` : `No ${direction.toLowerCase()} scene`}
        disabled={!only}
        onClick={() => only && onStep(only.sceneId)}
      />
    );
  }

  return (
    <span className="scene-steps__anchor" ref={root}>
      <IconButton
        icon={icon}
        label={`${direction} scene (${steps.length} options)`}
        active={open}
        ariaHasPopup="menu"
        ariaExpanded={open}
        onClick={() => setOpen((o) => !o)}
      />
      {open && (
        <ul className="scene-steps__menu" role="menu" aria-label={`${direction} scene`}>
          {steps.map((step) => (
            <li key={step.sceneId} role="none">
              <button
                type="button"
                role="menuitem"
                className="scene-steps__item"
                onClick={() => {
                  setOpen(false);
                  onStep(step.sceneId);
                }}
              >
                <span className="scene-steps__name">{step.name}</span>
                {step.label && <span className="scene-steps__label">{step.label}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </span>
  );
}
