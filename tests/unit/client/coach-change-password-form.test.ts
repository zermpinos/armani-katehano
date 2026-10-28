import { describe, it, expect } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ChangePasswordForm } from "@/client/coach/change-password-form";

const noop = () => {};

const html = renderToStaticMarkup(createElement(ChangePasswordForm, {
  currentPw: "", setCurrentPw: noop, newPw: "", setNewPw: noop, confirmPw: "", setConfirmPw: noop,
  changingPw: false, error: null, onSubmit: noop, onCancel: noop,
}));

describe("ChangePasswordForm", () => {
  it("submits only from UPDATE PASSWORD", () => {
    expect(html.match(/<button[^>]*type="(\w+)"[^>]*>UPDATE PASSWORD<\/button>/)?.[1]).toBe("submit");
  });

  it("does not submit the form from CANCEL", () => {
    expect(html.match(/<button[^>]*type="(\w+)"[^>]*>CANCEL<\/button>/)?.[1]).toBe("button");
  });
});
