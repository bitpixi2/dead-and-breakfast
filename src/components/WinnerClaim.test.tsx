import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { WinnerClaim } from "./WinnerClaim";

describe("WinnerClaim", () => {
  it("submits valid wallet addresses", async () => {
    const onSubmit = vi.fn(async () => undefined);

    render(<WinnerClaim onSubmit={onSubmit} />);
    fireEvent.change(screen.getByLabelText("Completion wallet address"), {
      target: { value: "0xB7D3A787A39F25457CA511DC3F0591B546F5E02F" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Submit wallet" }));

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(
        "0xB7D3A787A39F25457CA511DC3F0591B546F5E02F",
      ),
    );
    expect(
      await screen.findByText("Completion wallet logged. Use Play again when ready."),
    ).toBeTruthy();
  });

  it("shows validation without clearing invalid wallet addresses", () => {
    const onSubmit = vi.fn(async () => undefined);

    render(<WinnerClaim onSubmit={onSubmit} />);
    const input = screen.getByLabelText(
      "Completion wallet address",
    ) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "not-a-wallet" } });
    fireEvent.click(screen.getByRole("button", { name: "Submit wallet" }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(input.value).toBe("not-a-wallet");
    expect(screen.getByText("Enter a valid 0x wallet address.")).toBeTruthy();
  });

  it("skips without submitting a wallet", () => {
    const onSubmit = vi.fn(async () => undefined);

    render(<WinnerClaim onSubmit={onSubmit} />);
    fireEvent.click(screen.getByRole("button", { name: "Skip" }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(
      screen.getByText("Wallet claim skipped. Use Play again when ready."),
    ).toBeTruthy();
  });
});
