import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { BoardSettingsMenu } from "@/components/boards/boardHeaderMenus";

test("settings can remove and restore the Blocked column", async () => {
  const onToggleBlocked = jest.fn().mockResolvedValue(null);
  const { rerender } = render(
    <BoardSettingsMenu
      blockedVisible
      blockedCardCount={2}
      onEditLabels={() => {}}
      onEditMembers={() => {}}
      onToggleBlocked={onToggleBlocked}
    />
  );

  fireEvent.click(screen.getByRole("button", { name: "Settings" }));
  const blockedColumn = screen.getByRole("checkbox", { name: "Blocked column" });
  expect(blockedColumn).toBeChecked();

  fireEvent.click(blockedColumn);
  expect(onToggleBlocked).not.toHaveBeenCalled();
  expect(
    screen.getByText("Cards in Blocked will move to To Do.")
  ).toBeInTheDocument();

  fireEvent.click(
    screen.getByRole("button", { name: "Move cards to To Do and remove" })
  );
  await waitFor(() => expect(onToggleBlocked).toHaveBeenCalledWith(false));

  rerender(
    <BoardSettingsMenu
      blockedVisible={false}
      blockedCardCount={0}
      onEditLabels={() => {}}
      onEditMembers={() => {}}
      onToggleBlocked={onToggleBlocked}
    />
  );

  const restored = await screen.findByRole("checkbox", {
    name: "Blocked column",
  });
  await waitFor(() => expect(restored).toBeEnabled());
  expect(restored).not.toBeChecked();
  fireEvent.click(restored);
  await waitFor(() => expect(onToggleBlocked).toHaveBeenCalledWith(true));
});
