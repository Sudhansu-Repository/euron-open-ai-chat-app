import { act, renderHook } from "@testing-library/react-native";
import { PREF, prefs } from "../../lib/storage";
import { pushOffer, SLOW_ANSWER_MS, usePushOfferVisible } from "./offer";

describe("push offer", () => {
  afterEach(() => act(() => pushOffer.reset()));

  it("appears after a slow answer on an eligible device, never after a quick one", async () => {
    const { result } = await renderHook(() => usePushOfferVisible());
    await act(() => pushOffer.answered(SLOW_ANSWER_MS - 1, true));
    expect(result.current).toBe(false);
    await act(() => pushOffer.answered(SLOW_ANSWER_MS + 1, false));
    expect(result.current).toBe(false);
    await act(() => pushOffer.answered(SLOW_ANSWER_MS + 1, true));
    expect(result.current).toBe(true);
  });

  it("answering it, either way, means it never comes back", async () => {
    const { result } = await renderHook(() => usePushOfferVisible());
    await act(() => pushOffer.answered(SLOW_ANSWER_MS + 1, true));
    await act(() => pushOffer.close());
    expect(result.current).toBe(false);
    expect(prefs.getString(PREF.pushOffered)).toBeTruthy();
    await act(() => pushOffer.answered(SLOW_ANSWER_MS * 3, true));
    expect(result.current).toBe(false);
  });
});
