import { canReceivePush, conversationOf, pushDecision } from "./push";
import { PREF, prefs } from "./storage";

const base = { pushEnabled: true, hasFirebase: true, signedIn: true, permission: "granted" as const, offered: false };

describe("push decisions", () => {
  it("is off without Firebase, without server push, or signed out", () => {
    expect(pushDecision({ ...base, hasFirebase: false })).toBe("off");
    expect(pushDecision({ ...base, pushEnabled: false })).toBe("off");
    expect(pushDecision({ ...base, signedIn: false })).toBe("off");
  });

  it("registers when allowed, offers once when undecided, never nags after a refusal", () => {
    expect(pushDecision(base)).toBe("register");
    expect(pushDecision({ ...base, permission: "undetermined" })).toBe("offer");
    expect(pushDecision({ ...base, permission: "undetermined", offered: true })).toBe("off");
    expect(pushDecision({ ...base, permission: "denied" })).toBe("off");
  });

  it("opens only answer-ready notifications, and arms only a registered device", () => {
    expect(conversationOf({ data: { type: "turn", conversationId: "c1" } })).toBe("c1");
    expect(conversationOf({ data: { type: "other", conversationId: "c1" } })).toBeNull();
    expect(conversationOf(null)).toBeNull();
    expect(canReceivePush(true)).toBe(false);
    prefs.setString(PREF.pushToken, "tok");
    expect(canReceivePush(true)).toBe(true);
    expect(canReceivePush(false)).toBe(false);
    prefs.remove(PREF.pushToken);
  });
});
