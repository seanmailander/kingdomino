import { setProjectAnnotations } from "@storybook/react-vite";
import { vis, visAnnotations } from "storybook-addon-vis/vitest-setup";
import * as projectAnnotations from "./preview.ts";

setProjectAnnotations([visAnnotations, projectAnnotations]);

vis.setup();
