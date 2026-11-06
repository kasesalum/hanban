import { fireEvent, render, screen } from "@testing-library/react";
import DeadlinePicker, { calendarPosition } from "./deadlinePicker";

test("shifts the calendar left so it stays inside the ticket column", () => {
  const pos = calendarPosition({
    button: { left: 480, right: 600, top: 120, bottom: 152 },
    popup: { width: 288, height: 320 },
    bounds: { left: 40, right: 620 },
    viewport: { width: 1280, height: 800 },
  });

  expect(pos.left).toBe(312);
  expect(pos.left + 288).toBeLessThanOrEqual(620);
  expect(pos.top).toBe(160);
});

test("keeps the calendar under the button when it fits", () => {
  const pos = calendarPosition({
    button: { left: 80, right: 200, top: 120, bottom: 152 },
    popup: { width: 288, height: 320 },
    bounds: { left: 40, right: 620 },
    viewport: { width: 1280, height: 800 },
  });

  expect(pos.left).toBe(80);
  expect(pos.top).toBe(160);
});

test("opens the calendar above the button when the viewport is too short", () => {
  const pos = calendarPosition({
    button: { left: 80, right: 200, top: 700, bottom: 732 },
    popup: { width: 288, height: 320 },
    bounds: { left: 40, right: 620 },
    viewport: { width: 1280, height: 800 },
  });

  expect(pos.top).toBe(372);
});

test("places the open calendar inside the ticket column", () => {
  const column = document.createElement("div");
  column.style.overflowY = "auto";
  const host = document.createElement("div");
  column.appendChild(host);
  document.body.appendChild(column);

  jest.spyOn(column, "getBoundingClientRect").mockReturnValue({
    left: 40,
    right: 620,
    top: 0,
    bottom: 800,
    width: 580,
    height: 800,
    x: 40,
    y: 0,
    toJSON() {
      return {};
    },
  });

  render(<DeadlinePicker value="" onChange={() => {}} />, { container: host });
  const button = screen.getByRole("button", { name: /pick a date/i });
  jest.spyOn(button, "getBoundingClientRect").mockReturnValue({
    left: 480,
    right: 600,
    top: 120,
    bottom: 152,
    width: 120,
    height: 32,
    x: 480,
    y: 120,
    toJSON() {
      return {};
    },
  });

  fireEvent.click(button);

  const popup = document.body.querySelector(".fixed");
  expect(popup).toHaveStyle({ left: "312px", visibility: "visible" });

  column.remove();
});
