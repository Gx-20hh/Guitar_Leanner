import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach } from "vitest";

export { act, fireEvent, render, screen };

afterEach(() => {
  cleanup();
});
