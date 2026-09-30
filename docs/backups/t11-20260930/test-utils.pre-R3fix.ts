import { cleanup, render, screen } from "@testing-library/react";
import { afterEach } from "vitest";

export { render, screen };

afterEach(() => {
  cleanup();
});
