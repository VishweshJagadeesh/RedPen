/** The walkthrough: four flows, thirteen scenes. Retime a scene by editing its `dur` and cue times. */
import type { SceneDef } from "../engine/scene";
import { FLOW1 } from "./flow1";
import { FLOW2 } from "./flow2";
import { FLOW3 } from "./flow3";
import { FLOW4 } from "./flow4";

export const SCENES: SceneDef[] = [...FLOW1, ...FLOW2, ...FLOW3, ...FLOW4];
